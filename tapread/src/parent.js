// ===========================================================================
// Grown-ups area
// ===========================================================================
let PARENT = { tab: 'overview', readerId: null, sort: 'weight', from: 'library' };

function parentGate(then) {
  const a = 3 + Math.floor(Math.random() * 7), b = 4 + Math.floor(Math.random() * 6);
  modal(`<h3>Grown-ups only</h3><p class="muted">What is ${a} × ${b}?</p>
    <div class="row"><input class="field" id="gate" inputmode="numeric" autocomplete="off" style="width:120px"><button class="btn primary" id="gateOk">Go</button></div>`,
    (m, close) => {
      const inp = $('#gate', m); inp.focus();
      const go = () => { if (+inp.value === a * b) { close(); then(); } else { inp.value = ''; inp.placeholder = 'Try again'; } };
      $('#gateOk', m).onclick = go; inp.onkeydown = e => { if (e.key === 'Enter') go(); };
    });
}
async function openParent(tab) {
  PARENT.from = document.body.dataset.screen || 'library';
  if (tab) PARENT.tab = tab;
  PARENT.readerId = READER?.id || PARENT.readerId;
  await renderParent(); show('parent');
}
$('#parentBack').onclick = () => { if (READER) renderLibrary(); else renderReaders(); };
$('#parentTabs').onclick = e => { const t = e.target.closest('.tab'); if (!t) return; PARENT.tab = t.dataset.tab; renderParent(); };
$('#parentReader').onchange = e => { PARENT.readerId = e.target.value; renderParent(); };

async function renderParent() {
  const readers = await DB.all('readers');
  if (!PARENT.readerId || !readers.find(r => r.id === PARENT.readerId)) PARENT.readerId = readers[0]?.id || null;
  $('#parentReader').innerHTML = readers.map(r => `<option value="${r.id}" ${r.id === PARENT.readerId ? 'selected' : ''}>${r.face} ${esc(r.name)}</option>`).join('') || '<option>No readers yet</option>';
  $$('#parentTabs .tab').forEach(t => t.classList.toggle('on', t.dataset.tab === PARENT.tab));
  const body = $('#parentBody');
  const reader = readers.find(r => r.id === PARENT.readerId);
  const fn = { overview: renderOverview, words: renderWordsTab, stories: renderStoriesTab, settings: renderSettingsTab, lab: renderLab }[PARENT.tab];
  await fn(body, reader, readers);
}

const fmtDate = t => t ? new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—';
const boxes = n => `<span class="boxes" title="${n >= 5 ? 'Mastered' : 'Learning step ' + n + ' of 5'}">${[1, 2, 3, 4, 5].map(i => `<i class="${n >= i ? 'on' : ''}"></i>`).join('')}</span>`;

async function renderOverview(body, reader) {
  if (!reader) { body.innerHTML = `<div class="panel">Add a reader to see progress.</div>`; return; }
  const ev = await DB.byReader('events', reader.id), words = await DB.byReader('words', reader.id);
  const now = Date.now(), week = ev.filter(e => e.ts > now - 7 * DAY);
  const stories = await allStories(), title = id => stories.find(s => s.id === id)?.title || '(removed story)';
  const pages = new Set(ev.filter(e => e.type === 'page').map(e => e.storyId + ':' + e.page)).size;
  const finished = new Set(ev.filter(e => e.type === 'finish').map(e => e.storyId));
  const taps = ev.filter(e => e.type === 'tap').length;
  const ans = ev.filter(e => e.type === 'right' || e.type === 'wrong');
  const acc = ans.length ? Math.round(ans.filter(e => e.type === 'right').length / ans.length * 100) + '%' : '—';
  // daily minutes, last 14 days
  const days = [...Array(14)].map((_, i) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - 13 + i); return d.getTime(); });
  const mins = days.map(d => readingMinutes(ev.filter(e => e.ts >= d && e.ts < d + DAY)));
  const maxM = Math.max(5, ...mins);
  const toPractice = words.filter(w => w.box < 5 && (w.taps || w.wrong || w.readMiss)).sort((a, b) => weight(b) - weight(a)).slice(0, 18);
  const mastered = words.filter(w => w.box >= 5).sort((a, b) => b.due - a.due).slice(0, 18);
  const ra = ev.filter(e => e.type === 'readaloud');
  const raMissed = {}, raHes = {};
  for (const e of ra) { (e.missed || []).forEach(w => raMissed[w] = (raMissed[w] || 0) + 1); (e.hes || []).forEach(w => raHes[w] = (raHes[w] || 0) + 1); }
  const top = o => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 12);
  const recentBooks = []; for (const e of ev.filter(e => e.type === 'open').reverse()) if (!recentBooks.find(x => x.storyId === e.storyId)) recentBooks.push(e); recentBooks.splice(6);
  body.innerHTML = `
    <div class="cards">
      <div class="card"><div class="n">${Math.round(readingMinutes(week))}</div><div class="l">minutes this week</div></div>
      <div class="card"><div class="n">${Math.round(readingMinutes(ev))}</div><div class="l">minutes in all</div></div>
      <div class="card"><div class="n">${pages}</div><div class="l">pages read</div></div>
      <div class="card"><div class="n">${finished.size}</div><div class="l">books finished</div></div>
      <div class="card"><div class="n">${taps}</div><div class="l">words tapped for help</div></div>
      <div class="card"><div class="n">${acc}</div><div class="l">game answers right</div></div>
    </div>
    <div class="panel"><h3>Reading time, last 14 days</h3>
      <div class="bars">${mins.map((m, i) => `<div style="height:${Math.max(2, m / maxM * 100)}%" title="${Math.round(m)} min"><span>${new Date(days[i]).getDate()}</span></div>`).join('')}</div><div style="height:16px"></div></div>
    <div class="panel"><h3>Words to practice</h3>
      ${toPractice.length ? `<div class="wordcloud">${toPractice.map(w => `<span title="tapped ${w.taps}×">${esc(w.proper ? w.display : w.word)} <small class="muted">${w.taps ? w.taps + "×" : "read-aloud"}</small></span>`).join('')}</div>` : '<p class="muted">Nothing yet — words show up here when they’re tapped while reading.</p>'}
      ${mastered.length ? `<h4>Recently mastered</h4><div class="wordcloud">${mastered.map(w => `<span style="background:var(--teal-2)">${esc(w.word)}</span>`).join('')}</div>` : ''}</div>
    ${ra.length ? `<div class="panel"><h3>Reading out loud <span class="chip" style="background:var(--sun-2)">experimental</span></h3>
      <p class="note">${ra.length} page${ra.length > 1 ? 's' : ''} read aloud. These come from speech recognition, which can mishear — treat them as hints, not grades.</p>
      ${top(raHes).length ? `<h4>Paused before</h4><div class="wordcloud">${top(raHes).map(([w, n]) => `<span>${esc(w)} <small class="muted">${n}×</small></span>`).join('')}</div>` : ''}
      ${top(raMissed).length ? `<h4>Skipped or said differently</h4><div class="wordcloud">${top(raMissed).map(([w, n]) => `<span style="background:var(--tomato-2)">${esc(w)} <small class="muted">${n}×</small></span>`).join('')}</div>` : ''}</div>` : ''}
    <div class="panel"><h3>Recent books</h3>${recentBooks.length ? `<table>${recentBooks.map(e => `<tr><td>${esc(title(e.storyId))}</td><td class="muted">${fmtDate(e.ts)}</td><td>${finished.has(e.storyId) ? '✓ finished' : ''}</td></tr>`).join('')}</table>` : '<p class="muted">No books opened yet.</p>'}</div>`;
}

async function renderWordsTab(body, reader) {
  if (!reader) { body.innerHTML = `<div class="panel">Add a reader first.</div>`; return; }
  const words = await DB.byReader('words', reader.id);
  const keyFn = { weight: w => -weight(w), word: w => w.word, taps: w => -w.taps, last: w => -w.last, box: w => w.box, game: w => -(w.correct + w.wrong) }[PARENT.sort];
  words.sort((a, b) => { const x = keyFn(a), y = keyFn(b); return x < y ? -1 : x > y ? 1 : 0; });
  body.innerHTML = `<div class="panel"><h3>${words.length} words</h3>
    <p class="note">A tap while reading puts a word back to step 0. Getting it right on the first try in a game moves it up a step; five steps and it’s mastered. Practice order favours words that are due and tapped often recently.</p>
    <div class="table-wrap"><table><thead><tr>
      <th data-s="word">Word</th><th data-s="taps">Taps</th><th data-s="last">Last tapped</th><th data-s="game">Games ✓/✗</th><th>Said ✓/✗</th><th>Read-aloud</th><th data-s="box">Progress</th><th></th></tr></thead>
    <tbody>${words.map(w => `<tr><td class="wd">${esc(w.proper ? w.display : w.word)}</td><td>${w.taps}</td><td>${fmtDate(w.last)}</td><td>${w.correct}/${w.wrong}</td><td>${w.sayRight || 0}/${w.sayWrong || 0}</td>
      <td>${w.readMiss || w.readHes ? `${w.readMiss || 0} missed, ${w.readHes || 0} paused` : ''}</td><td>${boxes(w.box)}</td>
      <td><button class="btn small ghost" data-say="${esc(w.word)}">🔊</button><button class="btn small ghost" data-del="${esc(w.key)}" title="Remove">✕</button></td></tr>`).join('')}</tbody></table></div></div>`;
  $$('th[data-s]', body).forEach(th => th.onclick = () => { PARENT.sort = th.dataset.s; renderParent(); });
  $$('[data-say]', body).forEach(b => b.onclick = () => TTS.say(b.dataset.say, { word: true }));
  $$('[data-del]', body).forEach(b => b.onclick = async () => { await DB.del('words', b.dataset.del); renderParent(); });
}

async function renderStoriesTab(body) {
  const stories = await allStories();
  body.innerHTML = `<div class="panel"><h3>Add a story</h3>
      <p class="note">Import a <b>.txt</b>, <b>.html</b> or <b>.epub</b> file — Project Gutenberg EPUBs (like <i>The Wonderful Wizard of Oz</i> or <i>The Tale of Peter Rabbit</i>) work well. Or paste text below. In pasted text, a line with <code>---</code> starts a new page, <code># Title</code> sets the title, <code>## Chapter</code> starts a chapter, and <code>@pic 🐸</code> adds a picture. Without page breaks, long text is split into pages of about <b>${S.wordsPerPage}</b> words.</p>
      <div class="row"><input type="file" id="impFile" accept=".txt,.html,.htm,.xhtml,.epub,text/plain,text/html,application/epub+zip" class="hidden"><button class="btn primary" id="impPick">📂 Choose a file</button><span class="muted" id="impMsg"></span></div>
      <h4>Or paste a story</h4>
      <div class="row"><input class="field" id="impTitle" placeholder="Title" style="flex:1"></div>
      <textarea class="field" id="impText" placeholder="# The Frog Who Sang&#10;@pic 🐸&#10;A frog sat on a log.&#10;---&#10;He liked to sing."></textarea>
      <div class="row"><button class="btn teal" id="impSave">Add story</button></div></div>
    <div class="panel"><h3>Library</h3><table>${stories.map(s => `<tr><td style="font-size:22px">${s.coverImg ? '🖼️' : esc(s.cover)}</td><td><b>${esc(s.title)}</b><div class="muted" style="font-size:13px">${esc(s.author || '')} · ${s.pages.length} pages · level ${s.level}</div></td>
      <td><select class="field" data-lvl="${s.id}" ${s.builtin ? 'disabled' : ''}>${[1, 2, 3].map(l => `<option value="${l}" ${s.level === l ? 'selected' : ''}>${LEVEL_NAMES[l]}</option>`).join('')}</select></td>
      <td>${s.builtin ? '<span class="muted">built in</span>' : `<button class="btn small" data-rm="${s.id}">Delete</button>`}</td></tr>`).join('')}</table></div>`;
  $('#impPick').onclick = () => $('#impFile').click();
  $('#impFile').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    $('#impMsg').textContent = 'Reading…';
    try { const s = await saveImported(await importFile(f)); $('#impMsg').textContent = `Added “${s.title}” (${s.pages.length} pages).`; renderStoriesTab(body); toast(`Added “${s.title}”`); }
    catch (err) { console.error(err); $('#impMsg').textContent = 'Sorry: ' + (err.message || err); }
  };
  $('#impSave').onclick = async () => {
    const t = $('#impText').value.trim(); if (!t) return;
    const st = storyFromScript({ text: t, title: $('#impTitle').value.trim() });
    await saveImported(st); toast(`Added “${st.title}”`); renderStoriesTab(body);
  };
  $$('[data-rm]', body).forEach(b => b.onclick = async () => { if (!confirm('Delete this story? Reading progress stays in the stats.')) return; await DB.del('stories', b.dataset.rm); STORY_CACHE = null; renderStoriesTab(body); });
  $$('[data-lvl]', body).forEach(sel => sel.onchange = async () => { const s = await DB.get('stories', sel.dataset.lvl); s.level = +sel.value; await DB.put('stories', s); STORY_CACHE = null; });
}

async function renderSettingsTab(body, reader, readers) {
  const sysVoices = SystemVoice.voices;
  const ov = Object.entries(S.overrides);
  body.innerHTML = `
  <div class="panel"><h3>Voice</h3>
    <div class="row"><label>Speech engine</label>
      <select class="field" id="sEngine"><option value="system" ${S.engine === 'system' ? 'selected' : ''}>Device voice (instant, no download)</option><option value="kokoro" ${S.engine === 'kokoro' ? 'selected' : ''}>Kokoro (better voice, ~90 MB once)</option></select></div>
    <div id="sysBox" class="${S.engine === 'system' ? '' : 'hidden'}">
      <div class="row"><label>Device voice</label><select class="field" id="sVoice"><option value="">Automatic (best available)</option>${sysVoices.map(v => `<option value="${esc(v.voiceURI)}" ${v.voiceURI === S.sysVoice ? 'selected' : ''}>${esc(v.name)} (${v.lang})${v.localService ? '' : ' · online'}</option>`).join('')}</select></div>
      <div class="row"><label>Speed</label><input type="range" id="sRate" min="0.6" max="1.2" step="0.05" value="${S.rate}"><span id="sRateV">${S.rate}</span></div>
      ${sysVoices.length ? '' : '<p class="note">No English device voices found yet. Try reloading, or switch to Kokoro.</p>'}
    </div>
    <div id="kokBox" class="${S.engine === 'kokoro' ? '' : 'hidden'}">
      <div class="row"><label>Status</label><span id="kStatus">${Kokoro.ready ? '✓ Ready' : 'Not loaded'}</span>${Kokoro.ready ? '' : '<button class="btn small teal" id="kLoad">Download &amp; start</button>'}<div class="bar-prog ${Kokoro.loading && !Kokoro.ready ? '' : 'hidden'}" id="kBar"><i></i></div></div>
      <div class="row"><label>Kokoro voice</label><select class="field" id="kVoice">${Object.entries(KOKORO_VOICES).map(([k, v]) => `<option value="${k}" ${k === S.kokoroVoice ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
      <p class="note">Runs on this device in the background. Each word is generated once and then saved, so taps get faster as the library is used. Until it finishes loading, the device voice is used.</p>
      <div class="row"><button class="btn small" id="kClear">Clear saved audio</button></div>
    </div>
    <div class="row"><label>Try it</label><input class="field" id="sTry" value="The Wonderful Wizard of Oz" style="flex:1"><button class="btn small" id="sTryBtn">🔊</button></div>
  </div>
  <div class="panel"><h3>Pronunciation fixes</h3>
    <p class="note">For names and tricky words. Type the word, then how it should be said (respell it if needed, like “oz-muh” for Ozma).</p>
    <table>${ov.map(([w, s]) => `<tr><td class="wd">${esc(w)}</td><td>→ ${esc(s)}</td><td><button class="btn small ghost" data-ovsay="${esc(w)}">🔊</button><button class="btn small ghost" data-ovrm="${esc(w)}">✕</button></td></tr>`).join('') || '<tr><td class="muted">None yet</td></tr>'}</table>
    <div class="row"><input class="field" id="ovW" placeholder="word"><input class="field" id="ovS" placeholder="say it like"><button class="btn small teal" id="ovAdd">Add</button></div></div>
  <div class="panel"><h3>Reading</h3>
    <div class="row"><label>Text size</label><input type="range" id="sScale" min="0.8" max="1.5" step="0.05" value="${S.scale}"><span id="sScaleV">${Math.round(S.scale * 100)}%</span></div>
    <div class="row"><label>Words per page (imports)</label><input type="number" class="field" id="sWpp" min="20" max="400" value="${S.wordsPerPage}" style="width:100px"></div></div>
  <div class="panel"><h3>Speech recognition <span class="chip" style="background:var(--sun-2)">experimental</span></h3>
    <p class="note">Adds a <b>Say It!</b> game and an <b>I’ll read it</b> button (🎤) on book pages, using the Whistle model (17 MB, runs on this device; audio never leaves it). It was trained on adult speech, so test it with your reader in the <b>Speech lab</b> tab before relying on it.</p>
    <div class="row"><label>Enable</label><input type="checkbox" id="sRecog" ${S.recog ? 'checked' : ''} style="width:24px;height:24px"><span class="muted" id="rStatus">${Recog.ready ? '✓ Loaded' : ''}</span></div></div>
  <div class="panel"><h3>Readers</h3><table>${readers.map(r => `<tr><td style="font-size:26px">${r.face}</td><td><b>${esc(r.name)}</b></td><td><button class="btn small" data-edit="${r.id}">Edit</button> <button class="btn small ghost" data-reset="${r.id}">Reset stats</button> <button class="btn small ghost" data-rmr="${r.id}">Delete</button></td></tr>`).join('')}</table></div>
  <div class="panel"><h3>Backup</h3>
    <p class="note">Everything is stored only in this browser. Save a backup now and then — browsers can clear site data, and you can move a backup to another device.</p>
    <div class="row"><button class="btn" id="bExp">⬇️ Save backup</button><input type="file" id="bFile" accept=".json" class="hidden"><button class="btn" id="bImp">⬆️ Restore backup</button><span class="muted" id="bMsg"></span></div></div>`;

  const kBar = $('#kBar', body);
  $('#sEngine', body).onchange = async e => {
    S.engine = e.target.value; S.kokoroWanted = S.engine === 'kokoro'; await saveSettings(); renderSettingsTab(body, reader, readers);
  };
  $('#sVoice', body) && ($('#sVoice', body).onchange = e => { S.sysVoice = e.target.value; saveSettings(); TTS.say('Hello! Let’s read a story.'); });
  $('#sRate', body) && ($('#sRate', body).oninput = e => { S.rate = +e.target.value; $('#sRateV', body).textContent = S.rate; saveSettings(); });
  const kl = $('#kLoad', body);
  if (kl) kl.onclick = () => startKokoro(body, reader, readers);
  if (Kokoro.loading && !Kokoro.ready) Kokoro.loading.then(() => renderSettingsTab(body, reader, readers)).catch(() => {});
  $('#kVoice', body).onchange = e => { S.kokoroVoice = e.target.value; saveSettings(); Kokoro.mem.clear(); TTS.say('Hello! Let’s read a story.'); };
  $('#kClear', body).onclick = async () => { await DB.clear('audio'); Kokoro.mem.clear(); toast('Saved audio cleared'); };
  $('#sTryBtn', body).onclick = () => TTS.say($('#sTry', body).value);
  $('#ovAdd', body).onclick = () => { const w = normWord($('#ovW', body).value.trim()), s = $('#ovS', body).value.trim(); if (!w || !s) return; S.overrides[w] = s; saveSettings(); Kokoro.mem.clear(); renderSettingsTab(body, reader, readers); };
  $$('[data-ovrm]', body).forEach(b => b.onclick = () => { delete S.overrides[b.dataset.ovrm]; saveSettings(); renderSettingsTab(body, reader, readers); });
  $$('[data-ovsay]', body).forEach(b => b.onclick = () => TTS.say(b.dataset.ovsay, { word: true }));
  $('#sScale', body).oninput = e => { S.scale = +e.target.value; $('#sScaleV', body).textContent = Math.round(S.scale * 100) + '%'; saveSettings(); };
  $('#sWpp', body).onchange = e => { S.wordsPerPage = Math.max(20, Math.min(400, +e.target.value || 90)); saveSettings(); };
  $('#sRecog', body).onchange = async e => {
    S.recog = e.target.checked; await saveSettings();
    if (S.recog && !Recog.ready) { const ok = await loadRecogWithModal(); if (!ok) { S.recog = false; await saveSettings(); } }
    renderSettingsTab(body, reader, readers);
  };
  $$('[data-edit]', body).forEach(b => b.onclick = async () => editReader(await DB.get('readers', b.dataset.edit)));
  $$('[data-reset]', body).forEach(b => b.onclick = async () => { if (!confirm('Clear all reading stats and words for this reader?')) return; await DB.delByReader('events', b.dataset.reset); await DB.delByReader('words', b.dataset.reset); await KV.set('progress:' + b.dataset.reset, {}); toast('Stats cleared'); });
  $$('[data-rmr]', body).forEach(b => b.onclick = async () => {
    if (!confirm('Delete this reader and all their stats?')) return;
    const id = b.dataset.rmr; await DB.delByReader('events', id); await DB.delByReader('words', id); await DB.del('readers', id); await DB.del('kv', 'progress:' + id);
    if (READER?.id === id) READER = null; renderParent();
  });
  $('#bExp', body).onclick = exportBackup;
  $('#bImp', body).onclick = () => $('#bFile', body).click();
  $('#bFile', body).onchange = async e => { const f = e.target.files[0]; if (!f) return; try { await importBackup(JSON.parse(await f.text())); $('#bMsg', body).textContent = 'Restored.'; renderParent(); } catch (err) { $('#bMsg', body).textContent = 'Could not restore: ' + err.message; } };
  function startKokoro() {
    kBar.classList.remove('hidden'); $('#kStatus', body).textContent = 'Downloading…'; kl && (kl.disabled = true);
    Kokoro.load(p => { kBar.firstElementChild.style.width = Math.round(p * 100) + '%'; })
      .then(() => { S.kokoroWanted = true; saveSettings(); toast('Kokoro voice ready'); renderSettingsTab(body, reader, readers); TTS.say('Hello! Let’s read a story.'); })
      .catch(err => { console.error(err); $('#kStatus', body).textContent = 'Failed: ' + (err.message || err); kl && (kl.disabled = false); });
  }
}

async function exportBackup() {
  const data = { app: 'tapread', version: 1, exported: new Date().toISOString(), settings: S };
  for (const s of ['readers', 'stories', 'events', 'words']) data[s] = await DB.all(s);
  data.kv = {}; for (const r of data.readers) data.kv['progress:' + r.id] = await KV.get('progress:' + r.id);
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }));
  a.download = `tapread-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
async function importBackup(data) {
  if (data.app !== 'tapread') throw new Error('Not a Tap & Read backup.');
  for (const s of ['readers', 'stories', 'words']) for (const x of data[s] || []) await DB.put(s, x);
  for (const e of data.events || []) { const { id, ...rest } = e; await DB.put('events', rest); }
  for (const [k, v] of Object.entries(data.kv || {})) if (v) await KV.set(k, v);
  if (data.settings) { S = { ...DEFAULT_SETTINGS, ...data.settings }; await saveSettings(); }
  STORY_CACHE = null;
}

// ---------- Speech lab: measure recognition accuracy on this child ----------
// Grown-up chooses whether the next attempt will be said correctly or deliberately
// mispronounced; the reader says the word; we record what the recognizer decided.
let LAB = { trials: null, word: null, clips: [] };
async function renderLab(body, reader) {
  if (!LAB.trials) LAB.trials = (await KV.get('labTrials')) || [];
  const t = LAB.trials.filter(x => !reader || x.readerId === reader.id);
  const good = t.filter(x => x.intent === 'correct'), bad = t.filter(x => x.intent === 'wrong');
  const pct = (a, b) => b ? Math.round(a / b * 100) + '%' : '—';
  const frr = good.filter(x => x.verdict === 'different').length, unclear = good.filter(x => x.verdict === 'unclear').length;
  const far = bad.filter(x => x.verdict === 'right').length;
  if (!LAB.word) LAB.word = await labNextWord();
  body.innerHTML = `
  <div class="panel"><h3>Speech lab</h3>
    <p class="note">Checks how well speech recognition hears <b>this</b> reader before you trust the Say It game or read-aloud stats. Pick how the next word will be said, have the reader say it (or mispronounce it on purpose — “wabbit” for rabbit), and the lab records what the recognizer decided. About 30 correct and 15 mispronounced tries gives a usable picture.</p>
    ${Recog.ready ? '' : `<div class="row"><button class="btn teal" id="labLoad">Load speech recognition (17 MB)</button></div>`}
    <div class="${Recog.ready ? '' : 'hidden'}" style="text-align:center">
      <div class="prompt-word" style="display:inline-block;margin:10px 0">${esc(LAB.word)}</div>
      <div class="row" style="justify-content:center"><button class="btn small" id="labNext">↻ Different word</button><button class="btn small" id="labHear">🔊</button></div>
      <div class="row" style="justify-content:center;margin-top:14px">
        <button class="btn teal" data-intent="correct">🎤 Say it correctly</button>
        <button class="btn primary" data-intent="wrong">🎤 Say it wrong on purpose</button></div>
      <div class="row" style="justify-content:center"><div class="meter"><i id="labLvl"></i></div></div>
      <div class="feedback" id="labOut"></div></div></div>
  <div class="cards">
    <div class="card"><div class="n">${t.length}</div><div class="l">tries${reader ? ' for ' + esc(reader.name) : ''}</div></div>
    <div class="card"><div class="n">${pct(frr, good.length)}</div><div class="l">correct readings marked wrong (${frr}/${good.length})</div></div>
    <div class="card"><div class="n">${pct(unclear, good.length)}</div><div class="l">correct readings “didn’t catch that”</div></div>
    <div class="card"><div class="n">${pct(far, bad.length)}</div><div class="l">wrong readings accepted (${far}/${bad.length})</div></div>
  </div>
  <div class="panel"><h3>How to read this</h3><p class="note">The first number matters most: if correct readings are marked wrong more than about 1 in 10 times, the Say It game will frustrate a young reader — keep it off and use read-aloud only as a quiet hint for you. A high “wrong readings accepted” rate just means the game is lenient, which is the safer failure.</p></div>
  <div class="panel"><h3>Tries</h3><div class="row"><button class="btn small" id="labCsv">⬇️ Export CSV</button><button class="btn small ghost" id="labClr">Clear</button></div>
    <div class="table-wrap"><table><thead><tr><th>When</th><th>Word</th><th>Intended</th><th>Heard</th><th>Decision</th><th>Confidence</th><th></th></tr></thead><tbody>
    ${t.slice().reverse().slice(0, 100).map((x, k) => `<tr><td class="muted">${new Date(x.ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</td><td class="wd">${esc(x.word)}</td><td>${x.intent === 'correct' ? 'correct' : '<b>wrong</b>'}</td><td>${esc(x.heard || '∅')}</td>
      <td>${x.verdict === 'right' ? '✓ right' : x.verdict === 'unclear' ? '? unclear' : '✗ different'}</td><td>${x.p != null ? x.p.toFixed(2) : ''}</td><td>${LAB.clips[x.ts] ? `<button class="btn small ghost" data-play="${x.ts}">▶︎</button>` : ''}</td></tr>`).join('')}</tbody></table></div></div>`;
  $('#labLoad', body) && ($('#labLoad', body).onclick = async () => { if (await loadRecogWithModal()) renderLab(body, reader); });
  $('#labNext', body) && ($('#labNext', body).onclick = async () => { LAB.word = await labNextWord(); renderLab(body, reader); });
  $('#labHear', body) && ($('#labHear', body).onclick = () => TTS.say(LAB.word, { word: true }));
  $$('[data-intent]', body).forEach(b => b.onclick = async () => {
    $$('[data-intent]', body).forEach(x => x.disabled = true); TTS.stop();
    $('#labOut', body).textContent = 'Listening…';
    try {
      const rec = await Recog.record({ maxMs: 5000, silenceMs: 900, onLevel: v => { const l = $('#labLvl', body); if (l) l.style.width = Math.min(100, v * 400) + '%'; } });
      $('#labOut', body).textContent = 'Thinking…';
      const res = rec.speech ? await Recog.transcribe(rec) : null;
      const v = judgeWord(LAB.word, res);
      const trial = { ts: Date.now(), readerId: reader?.id, word: LAB.word, intent: b.dataset.intent, verdict: v.verdict, heard: v.heard, p: v.p };
      LAB.clips[trial.ts] = rec; LAB.trials.push(trial); await KV.set('labTrials', LAB.trials);
      LAB.word = await labNextWord();
    } catch (e) { $('#labOut', body).textContent = 'Microphone error: ' + (e.message || e); return; }
    finally { Recog.closeMic(); }
    renderLab(body, reader);
  });
  $$('[data-play]', body).forEach(b => b.onclick = () => { const r = LAB.clips[b.dataset.play]; Player.play({ audio: r.samples, sr: r.sampleRate }); });
  $('#labCsv', body).onclick = () => {
    const rows = [['time', 'reader', 'word', 'intended', 'heard', 'decision', 'confidence'], ...t.map(x => [new Date(x.ts).toISOString(), x.readerId || '', x.word, x.intent, x.heard || '', x.verdict, x.p ?? ''])];
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')], { type: 'text/csv' })); a.download = 'speech-lab.csv'; a.click();
  };
  $('#labClr', body).onclick = async () => { if (!confirm('Clear all lab results?')) return; LAB.trials = LAB.trials.filter(x => reader && x.readerId !== reader.id); await KV.set('labTrials', LAB.trials); renderLab(body, reader); };
}
async function labNextWord() {
  const pw = await practiceWords(20);
  const pool = pw.length >= 5 ? pw.map(w => w.word) : (await vocabPool()).filter(w => w.length >= 3 && w.length <= 8);
  return pool[Math.floor(Math.random() * pool.length)] || 'rabbit';
}
