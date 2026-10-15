// ===========================================================================
// Speech output: system voices (Web Speech API) and Kokoro (in a worker)
// ===========================================================================
let AC = null;
function audioCtx() {
  if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)();
  if (AC.state === 'suspended') AC.resume();
  return AC;
}

const SystemVoice = {
  voices: [],
  init() {
    if (!('speechSynthesis' in window)) return;
    const load = () => { this.voices = speechSynthesis.getVoices().filter(v => /^en/i.test(v.lang)); };
    load(); speechSynthesis.addEventListener?.('voiceschanged', load);
  },
  pick() {
    if (S.sysVoice) { const v = this.voices.find(v => v.voiceURI === S.sysVoice); if (v) return v; }
    const score = v => (v.localService ? 4 : 0) + (/natural|neural|premium|enhanced/i.test(v.name) ? 6 : 0) +
      (/samantha|ava|allison|aria|jenny|google us english|serena|karen|daniel/i.test(v.name) ? 3 : 0) + (/en-US/i.test(v.lang) ? 1 : 0) +
      (/compact|eloquence|novelty|whisper|bells|bad news|albert|zarvox|trinoids|bubbles|boing|cellos|organ|jester|superstar|wobble/i.test(v.name) ? -10 : 0);
    return [...this.voices].sort((a, b) => score(b) - score(a))[0] || null;
  },
  speak(text, { onBoundary } = {}) {
    return new Promise(resolve => {
      if (!('speechSynthesis' in window)) return resolve();
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const v = this.pick(); if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'en-US';
      u.rate = S.rate; u.pitch = 1.05;
      const done = () => { clearTimeout(t); resolve(); };
      u.onend = done; u.onerror = done;
      if (onBoundary) u.onboundary = e => { if (e.name !== 'sentence') onBoundary(e.charIndex); };
      // Some engines never fire onend; don't hang forever.
      const t = setTimeout(done, 1500 + text.length * 120);
      speechSynthesis.speak(u);
    });
  },
  stop() { if ('speechSynthesis' in window) speechSynthesis.cancel(); },
};

// Kokoro-82M via kokoro-js, loaded from jsDelivr inside a module worker so
// synthesis never blocks the page. Weights (~90 MB, q8) come from Hugging Face
// and are cached by the browser after the first download.
const KOKORO_VOICES = { af_heart: 'Heart (US, warm)', af_bella: 'Bella (US)', af_nicole: 'Nicole (US, soft)', am_michael: 'Michael (US)', am_fenrir: 'Fenrir (US)', bf_emma: 'Emma (UK)', bm_george: 'George (UK)' };
const Kokoro = {
  worker: null, ready: false, loading: null, jobs: [], busy: false, mem: new Map(), id: 0, waiters: new Map(),
  load(onProgress) {
    if (this.ready) return Promise.resolve();
    if (this.loading) return this.loading;
    const src = `
      import { KokoroTTS } from "https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/dist/kokoro.web.js";
      let tts;
      self.onmessage = async ({ data: m }) => {
        try {
          if (m.type === 'load') {
            tts = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX",
              { dtype: "q8", device: "wasm", progress_callback: p => self.postMessage({ type: 'progress', p }) });
            self.postMessage({ type: 'ready' });
          } else if (m.type === 'gen') {
            const a = await tts.generate(m.text, { voice: m.voice, speed: m.speed });
            const audio = a.audio instanceof Float32Array ? a.audio : Float32Array.from(a.audio);
            self.postMessage({ type: 'audio', id: m.id, audio, sr: a.sampling_rate }, [audio.buffer]);
          }
        } catch (err) { self.postMessage({ type: 'error', id: m.id, error: String(err && err.message || err) }); }
      };`;
    this.loading = new Promise((resolve, reject) => {
      try {
        this.worker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })), { type: 'module' });
      } catch (e) { this.loading = null; return reject(e); }
      const files = {};
      this.worker.onmessage = ({ data: m }) => {
        if (m.type === 'progress') {
          const p = m.p || {};
          if (p.file && p.total) files[p.file] = [p.loaded || 0, p.total];
          const tot = Object.values(files).reduce((a, [, t]) => a + t, 0), got = Object.values(files).reduce((a, [l]) => a + l, 0);
          onProgress?.(tot ? got / tot : 0, p.status);
        } else if (m.type === 'ready') { this.ready = true; resolve(); }
        else if (m.type === 'audio' || m.type === 'error') {
          const w = this.waiters.get(m.id);
          if (w) { this.waiters.delete(m.id); m.type === 'audio' ? w.resolve({ audio: m.audio, sr: m.sr }) : w.reject(new Error(m.error)); }
          else if (m.type === 'error' && !this.ready) { this.loading = null; reject(new Error(m.error)); }
        }
      };
      this.worker.onerror = e => { e.preventDefault?.(); this.loading = null; reject(new Error(e.message || 'Kokoro worker failed to start')); };
      this.worker.postMessage({ type: 'load' });
    });
    return this.loading;
  },
  key(text) { return `k|${S.kokoroVoice}|${text}`; },
  // Priority queue: taps jump ahead of background pre-warming.
  get(text, urgent = false) {
    const key = this.key(text);
    if (this.mem.has(key)) return Promise.resolve(this.mem.get(key));
    const existing = this.jobs.find(j => j.key === key);
    if (existing) { if (urgent) { this.jobs = [existing, ...this.jobs.filter(j => j !== existing)]; existing.urgent = true; } return existing.promise; }
    if (this.inflight?.key === key) return this.inflight.promise;
    let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; });
    const job = { key, text, urgent, promise, resolve, reject };
    urgent ? this.jobs.unshift(job) : this.jobs.push(job);
    this.pump();
    return promise;
  },
  dropBackground() { const keep = []; for (const j of this.jobs) j.urgent ? keep.push(j) : j.resolve(null); this.jobs = keep; },
  async pump() {
    if (this.busy) return; this.busy = true;
    while (this.jobs.length) {
      const job = this.jobs.shift(); this.inflight = job;
      try {
        let clip = await DB.get('audio', job.key);
        if (!clip) {
          const id = ++this.id;
          clip = await new Promise((resolve, reject) => { this.waiters.set(id, { resolve, reject }); this.worker.postMessage({ type: 'gen', id, text: job.text, voice: S.kokoroVoice, speed: 0.92 }); });
          DB.put('audio', clip, job.key).catch(() => {});
        }
        this.mem.set(job.key, clip); if (this.mem.size > 400) this.mem.delete(this.mem.keys().next().value);
        job.resolve(clip);
      } catch (e) { job.reject(e); }
    }
    this.inflight = null; this.busy = false;
  },
};

const Player = {
  src: null,
  play({ audio, sr }) {
    this.stop();
    const ctx = audioCtx(), buf = ctx.createBuffer(1, audio.length, sr);
    buf.copyToChannel(audio, 0);
    const s = ctx.createBufferSource(); s.buffer = buf; s.connect(ctx.destination);
    this.src = s;
    return new Promise(res => { s.onended = () => { if (this.src === s) this.src = null; res(); }; s.start(); });
  },
  stop() { try { this.src?.stop(); } catch {} this.src = null; },
};

// Unified speech API ---------------------------------------------------------
const TTS = {
  token: 0,
  usingKokoro() { return S.engine === 'kokoro' && Kokoro.ready; },
  stop() { this.token++; SystemVoice.stop(); Player.stop(); },
  // Speak a word or a short phrase. Single words get a period for falling intonation.
  async say(text, { word = false } = {}) {
    const my = ++this.token; SystemVoice.stop(); Player.stop();
    let t = speakable(text).trim(); if (!t) return;
    if (this.usingKokoro()) {
      if (word && !/[.!?]$/.test(t)) t += '.';
      try { const clip = await Kokoro.get(t, true); if (clip && my === this.token) await Player.play(clip); return; }
      catch (e) { console.warn('Kokoro failed, using system voice', e); }
    }
    if (my === this.token) await SystemVoice.speak(t);
  },
  // Speak a list of sentences in order; onSentence(i) fires as each begins.
  async sayAll(sentences, onSentence) {
    const my = ++this.token; SystemVoice.stop(); Player.stop();
    for (let i = 0; i < sentences.length; i++) {
      if (my !== this.token) return false;
      onSentence?.(i);
      const t = speakable(sentences[i]).trim(); if (!t) continue;
      if (this.usingKokoro()) {
        try { if (i + 1 < sentences.length) Kokoro.get(speakable(sentences[i + 1]).trim(), true); const clip = await Kokoro.get(t, true); if (my !== this.token) return false; if (clip) { await Player.play(clip); continue; } } catch {}
      }
      await SystemVoice.speak(t);
    }
    return my === this.token;
  },
  prewarm(words) {
    if (!this.usingKokoro()) return;
    Kokoro.dropBackground();
    for (const w of words) { let t = speakable(w).trim(); if (t) { if (!/[.!?]$/.test(t)) t += '.'; Kokoro.get(t, false).catch(() => {}); } }
  },
};

// Little non-verbal sounds for games.
function chime(kind = 'good') {
  try {
    const ctx = audioCtx(), now = ctx.currentTime;
    const notes = kind === 'good' ? [523, 659, 784] : kind === 'win' ? [523, 659, 784, 1047] : kind === 'flip' ? [880] : [330, 262];
    notes.forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = kind === 'oops' ? 'triangle' : 'sine'; o.frequency.value = f;
      const t = now + i * (kind === 'flip' ? 0 : 0.09);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
      o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + 0.3);
    });
  } catch {}
}
function confetti(x = innerWidth / 2, y = innerHeight / 2, n = 14) {
  const em = ['⭐', '🌟', '✨', '🎉', '💛', '🎈'];
  for (let i = 0; i < n; i++) {
    const s = document.createElement('div'); s.className = 'confetti'; s.textContent = em[i % em.length];
    s.style.left = x + 'px'; s.style.top = y + 'px';
    s.style.setProperty('--dx', (Math.random() * 360 - 180) + 'px'); s.style.setProperty('--dy', (Math.random() * -260 - 40) + 'px'); s.style.setProperty('--rot', (Math.random() * 540 - 270) + 'deg');
    document.body.appendChild(s); setTimeout(() => s.remove(), 1200);
  }
}
const PRAISE = ['Great job!', 'You got it!', 'Super!', 'Way to go!', 'Awesome!', 'Yes! Nice work!'];
const praise = () => PRAISE[Math.floor(Math.random() * PRAISE.length)];
