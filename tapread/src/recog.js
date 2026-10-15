// ===========================================================================
// Speech recognition (experimental): Whistle via the cactus-needle WASM build
// ===========================================================================
// Files live next to index.html in vendor/cactus-needle (the worker must be same-origin).
// The 16.9 MB model downloads from Hugging Face on first use and is cached by the browser.
const Recog = {
  ready: false, loading: null, whistle: null, stream: null, _stop: null,
  load(onProgress) {
    if (this.ready) return Promise.resolve();
    if (this.loading) return this.loading;
    this.loading = (async () => {
      const mod = await import('./vendor/cactus-needle/dist/browser/index.js');
      this.whistle = await mod.createWhistle({ onDownloadProgress: p => onProgress?.((p.percentage ?? 0) / 100) });
      this.ready = true;
    })().catch(e => { this.loading = null; throw e; });
    return this.loading;
  },
  async openMic() {
    if (this.stream?.active) return this.stream;
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
    return this.stream;
  },
  closeMic() { this._stop?.(); this.stream?.getTracks().forEach(t => t.stop()); this.stream = null; },
  cancel() { this._cancelled = true; this._stop?.(); },
  stopEarly() { this._stop?.(); },
  // Record until the speaker goes quiet (after having spoken), or maxMs.
  // Returns { samples, sampleRate, speech } at the context's native rate; Whistle resamples.
  async record({ maxMs = 5000, silenceMs = 900, noSpeechMs = 6000, onLevel } = {}) {
    const stream = await this.openMic(); this._cancelled = false;
    const ctx = audioCtx(); const src = ctx.createMediaStreamSource(stream);
    const proc = ctx.createScriptProcessor(4096, 1, 1); const sink = ctx.createGain(); sink.gain.value = 0;
    const chunks = []; let floor = 0.006, speech = false, lastLoud = 0, started = performance.now(), calib = [];
    src.connect(proc); proc.connect(sink); sink.connect(ctx.destination);
    return new Promise(resolve => {
      const finish = () => {
        if (!this._stop) return; this._stop = null;
        proc.disconnect(); src.disconnect(); sink.disconnect(); onLevel?.(0);
        const n = chunks.reduce((a, c) => a + c.length, 0), samples = new Float32Array(n); let o = 0;
        for (const c of chunks) { samples.set(c, o); o += c.length; }
        // Keep at most 29.5 s, Whistle's single-pass limit.
        const cap = Math.floor(ctx.sampleRate * 29.5);
        resolve({ samples: samples.length > cap ? samples.subarray(0, cap) : samples, sampleRate: ctx.sampleRate, speech: speech && !this._cancelled });
      };
      this._stop = finish;
      proc.onaudioprocess = e => {
        const d = new Float32Array(e.inputBuffer.getChannelData(0)); chunks.push(d);
        let sum = 0; for (let i = 0; i < d.length; i++) sum += d[i] * d[i];
        const rms = Math.sqrt(sum / d.length), now = performance.now(), el = now - started;
        onLevel?.(rms);
        if (el < 300) { calib.push(rms); floor = Math.max(0.004, calib.reduce((a, b) => a + b, 0) / calib.length); return; }
        const loud = rms > Math.max(0.018, floor * 3);
        if (loud) { speech = true; lastLoud = now; }
        if ((speech && now - lastLoud > silenceMs) || el > maxMs || (!speech && el > noSpeechMs)) finish();
      };
    });
  },
  async transcribe(rec) {
    return this.whistle.transcribe({ samples: rec.samples, sampleRate: rec.sampleRate }, { language: 'en', wordTimestamps: true });
  },
};

function resultWords(res) {
  if (!res) return [];
  const ws = (res.words?.length ? res.words : (res.text || '').split(/\s+/).map(w => ({ word: w })));
  return ws.flatMap(w => (String(w.word).match(WORD_RE) || []).map(t => ({ w: normWord(t), start: w.start, end: w.end, p: w.probability ?? 1 })));
}

// Single word check. No keyword biasing: biasing toward the target would make it
// "hear" the right word even when the child said something else.
function judgeWord(target, res) {
  const ws = resultWords(res);
  const heard = ws.map(w => w.w).join(' ');
  if (!ws.length) return { verdict: 'unclear', heard };
  const hit = ws.find(w => sameWord(w.w, target));
  if (hit) return { verdict: 'right', heard, p: hit.p };
  const top = Math.max(...ws.map(w => w.p));
  if (top < 0.45) return { verdict: 'unclear', heard, p: top };
  return { verdict: 'different', heard, p: top };
}

// Word alignment of what was read (hyp) against the page text (ref).
// Insertions (repeats, sounding-out fragments, "um") cost little; words after the last
// one the reader reached are "unreached", not misses (the reader may have stopped early).
function alignReading(ref, hyp) {
  const n = ref.length, m = hyp.length, INS = 0.6, DEL = 1, SUB = 1.2;
  const D = Array.from({ length: n + 1 }, () => new Float32Array(m + 1)), P = Array.from({ length: n + 1 }, () => new Uint8Array(m + 1));
  for (let i = 1; i <= n; i++) { D[i][0] = i * DEL; P[i][0] = 2; }
  for (let j = 1; j <= m; j++) { D[0][j] = j * INS; P[0][j] = 3; }
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) {
    const same = sameWord(ref[i - 1], hyp[j - 1].w);
    let best = D[i - 1][j - 1] + (same ? 0 : SUB), p = same ? 0 : 1;
    if (D[i - 1][j] + DEL < best) { best = D[i - 1][j] + DEL; p = 2; }
    if (D[i][j - 1] + INS < best) { best = D[i][j - 1] + INS; p = 3; }
    D[i][j] = best; P[i][j] = p;
  }
  // free end: choose the last ref position reached
  let bi = n, bv = D[n][m];
  for (let i = 0; i < n; i++) if (D[i][m] < bv) { bv = D[i][m]; bi = i; }
  const out = ref.map(w => ({ ref: w, status: 'unreached', j: -1, insBefore: 0 }));
  let i = bi, j = m, pendingIns = 0;
  while (i > 0 || j > 0) {
    const p = i > 0 && j > 0 ? P[i][j] : i > 0 ? 2 : 3;
    if (p === 0 || p === 1) { out[i - 1].status = p === 0 ? 'ok' : 'sub'; out[i - 1].j = j - 1; i--; j--; }
    else if (p === 2) { out[i - 1].status = 'skip'; i--; }
    else { j--; if (i < n) out[i].insBefore++; }   // extra word heard just before ref[i]
  }
  return out;
}

// Turn alignment + timestamps into per-word results.
function scoreReading(ref, res) {
  const hyp = resultWords(res);
  const al = alignReading(ref, hyp);
  const gaps = [];
  for (const a of al) if (a.j > 0 && hyp[a.j].start != null && hyp[a.j - 1].end != null) gaps.push(hyp[a.j].start - hyp[a.j - 1].end);
  const med = gaps.length ? [...gaps].sort((a, b) => a - b)[Math.floor(gaps.length / 2)] : 0.2;
  const hesLimit = Math.max(1.0, med * 3);
  for (const a of al) {
    if (a.j > 0 && hyp[a.j].start != null && hyp[a.j - 1].end != null) a.gap = hyp[a.j].start - hyp[a.j - 1].end;
    a.hes = (a.status === 'ok' || a.status === 'sub') && ((a.gap || 0) > hesLimit || a.insBefore >= 2);
  }
  const reached = al.filter(a => a.status !== 'unreached');
  const ok = reached.filter(a => a.status === 'ok').length;
  return { al, hyp, reached: reached.length, ok, ratio: reached.length ? ok / reached.length : 0, hesLimit };
}

async function loadRecogWithModal() {
  if (Recog.ready) return true;
  return new Promise(resolve => {
    modal(`<h3>Loading speech recognition…</h3><p class="note">The first time, this downloads a 17 MB speech model. Audio never leaves this device.</p>
      <div class="row"><div class="bar-prog"><i id="rp"></i></div></div><p class="note" id="rmsg"></p>`, async (m, close) => {
      try {
        await Recog.load(p => { const el = $('#rp', m); if (el) el.style.width = Math.round(p * 100) + '%'; });
        close(); resolve(true); $('#readAloudBtn').classList.toggle('hidden', !S.recog);
      } catch (e) {
        console.error(e);
        $('#rmsg', m).innerHTML = `Couldn’t load it: ${esc(e.message || e)}<br>Check that the <code>vendor/cactus-needle</code> folder is next to index.html and the page is served over https or localhost.`;
        const b = document.createElement('button'); b.className = 'btn'; b.textContent = 'Close'; b.onclick = () => { close(); resolve(false); }; m.appendChild(b);
      }
    });
  });
}

// "I'll read it!" — record the child reading the page, then score it quietly.
// The child only ever gets encouragement; details go to the grown-ups' view.
async function readAloud() {
  if (!Recog.ready && !(await loadRecogWithModal())) return;
  TTS.stop(); clearHighlights();
  // Score the story text only — not the title, byline or page number.
  const spans = $$('#pageInner .w:not([data-num])').filter(e => !e.closest('.title'));
  const ref = spans.map(e => normWord(e.textContent));
  if (!ref.length) return;
  const bar = document.createElement('div'); bar.className = 'listen-bar';
  bar.innerHTML = `<span>🎤 Read the page out loud…</span><div class="meter"><i></i></div><button class="btn small primary">I’m done</button>`;
  document.body.appendChild(bar);
  bar.querySelector('button').onclick = () => Recog.stopEarly();
  const page = B.page, story = B.story;
  let rec;
  try { rec = await Recog.record({ maxMs: 29000, silenceMs: 3500, noSpeechMs: 8000, onLevel: v => { const i = bar.querySelector('.meter i'); if (i) i.style.width = Math.min(100, v * 400) + '%'; } }); }
  catch { bar.remove(); toast('Microphone not available'); return; }
  bar.querySelector('span').textContent = '⭐ Checking…'; bar.querySelector('button').remove();
  let res = null;
  try { if (rec.speech) res = await Recog.transcribe(rec); } catch (e) { console.warn(e); }
  bar.remove(); Recog.closeMic();
  if (!res || !resultWords(res).length) { toast('I didn’t hear any reading. Try again!'); return; }
  const sc = scoreReading(ref, res);
  const stars = sc.ratio >= 0.9 ? 3 : sc.ratio >= 0.7 ? 2 : 1;
  const missed = [], hes = [];
  sc.al.forEach((a, k) => {
    if (a.status === 'unreached') return;
    const w = spans[k].textContent;
    if (a.status === 'skip' || a.status === 'sub') { missed.push(normWord(w)); recordAnswer(w, 'read-miss', { storyId: story.id, page, heard: a.j >= 0 ? sc.hyp[a.j].w : '' }); }
    else if (a.hes) { hes.push(normWord(w)); recordAnswer(w, 'read-hes', { storyId: story.id, page, gap: a.gap }); }
  });
  logEvent({ type: 'readaloud', storyId: story.id, page, reached: sc.reached, ok: sc.ok, missed, hes, heard: sc.hyp.map(h => h.w).join(' ') });
  chime(stars === 3 ? 'win' : 'good'); confetti(innerWidth / 2, innerHeight - 120, 8 + stars * 6);
  const msg = stars === 3 ? `Wonderful reading, ${READER.name}!` : stars === 2 ? 'Great reading!' : 'Good reading! Keep going!';
  toast(`${'⭐'.repeat(stars)}  ${msg}`, 3000); TTS.say(msg);
}
