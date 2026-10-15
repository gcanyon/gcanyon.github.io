// ===========================================================================
// Screens: readers, library, book
// ===========================================================================
const FACES = ['🦊', '🐼', '🦁', '🐸', '🐙', '🦄', '🐯', '🐨', '🐵', '🐧', '🦉', '🐢'];
const COLORS = ['#fbe1d7', '#d6f0ec', '#fdf0cf', '#ece5f6', '#dcebfa', '#fde2ef'];

function show(id) {
  TTS.stop(); Recog.cancel?.();
  $$('.screen').forEach(s => s.classList.toggle('on', s.id === 'scr-' + id));
  document.body.dataset.screen = id;
  window.scrollTo(0, 0);
}

function modal(html, onMount) {
  const root = $('#modalRoot');
  root.innerHTML = `<div class="modal-back"><div class="modal" role="dialog">${html}</div></div>`;
  const back = root.firstElementChild;
  const close = () => { root.innerHTML = ''; };
  back.addEventListener('click', e => { if (e.target === back) close(); });
  onMount?.(back.firstElementChild, close);
  return close;
}

// ---------- readers ----------------------------------------------------------
async function renderReaders() {
  const readers = (await DB.all('readers')).sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0));
  $('#readerList').innerHTML = readers.map(r => `
    <button class="reader-card" data-id="${r.id}"><span class="face" style="background:${r.color}">${r.face}</span><span class="nm">${esc(r.name)}</span></button>`).join('') +
    `<button class="reader-card add" id="addReader"><span class="face">➕</span><span class="nm">New reader</span></button>`;
  $$('#readerList .reader-card[data-id]').forEach(b => b.onclick = () => chooseReader(readers.find(r => r.id === b.dataset.id)));
  $('#addReader').onclick = () => editReader();
  show('readers');
}
function editReader(existing) {
  let face = existing?.face || FACES[Math.floor(Math.random() * FACES.length)], color = existing?.color || COLORS[0];
  modal(`<h3>${existing ? 'Edit reader' : 'New reader'}</h3>
    <div class="row"><input class="field" id="rName" placeholder="Name" maxlength="20" style="flex:1" value="${esc(existing?.name || '')}"></div>
    <p class="muted" style="margin:14px 0 6px">Pick a buddy</p><div class="swatches" id="rFaces">${FACES.map(f => `<button data-f="${f}" class="${f === face ? 'on' : ''}">${f}</button>`).join('')}</div>
    <p class="muted" style="margin:14px 0 6px">Pick a color</p><div class="swatches" id="rColors">${COLORS.map(c => `<button data-c="${c}" style="background:${c}" class="${c === color ? 'on' : ''}"></button>`).join('')}</div>
    <div class="row" style="justify-content:flex-end;margin-top:20px"><button class="btn ghost" data-x>Cancel</button><button class="btn primary" id="rSave">Save</button></div>`,
    (m, close) => {
      $('#rName', m).focus();
      $$('#rFaces button', m).forEach(b => b.onclick = () => { face = b.dataset.f; $$('#rFaces button', m).forEach(x => x.classList.toggle('on', x === b)); TTS.say(nameOf(b.dataset.f)); });
      $$('#rColors button', m).forEach(b => b.onclick = () => { color = b.dataset.c; $$('#rColors button', m).forEach(x => x.classList.toggle('on', x === b)); });
      $('[data-x]', m).onclick = close;
      $('#rSave', m).onclick = async () => {
        const name = $('#rName', m).value.trim(); if (!name) return $('#rName', m).focus();
        const r = { ...(existing || { id: 'r-' + uid(), created: Date.now() }), name, face, color };
        await DB.put('readers', r); close();
        if (existing) { if (READER?.id === r.id) READER = r; renderParent(); } else chooseReader(r);
      };
    });
}
const nameOf = f => ({ '🦊': 'fox', '🐼': 'panda', '🦁': 'lion', '🐸': 'frog', '🐙': 'octopus', '🦄': 'unicorn', '🐯': 'tiger', '🐨': 'koala', '🐵': 'monkey', '🐧': 'penguin', '🦉': 'owl', '🐢': 'turtle' }[f] || '');

async function chooseReader(r) {
  READER = r; r.lastUsed = Date.now(); await DB.put('readers', r); await KV.set('lastReader', r.id);
  TTS.say(`Hi ${r.name}!`);
  renderLibrary();
}

// ---------- library ----------------------------------------------------------
let STORY_CACHE = null;
async function allStories() {
  if (!STORY_CACHE) {
    const user = await DB.all('stories');
    STORY_CACHE = [...BUILTIN_STORIES.map(b => storyFromScript({ ...b, builtin: true })), ...user.sort((a, b) => a.added - b.added)];
  }
  return STORY_CACHE;
}
const LEVEL_NAMES = { 1: 'First words', 2: 'Short stories', 3: 'Chapter books' };
async function renderLibrary() {
  if (!READER) return renderReaders();
  $('#libFace').textContent = READER.face; $('#libFace').style.background = READER.color;
  $('#libHello').textContent = `Hi, ${READER.name}!`;
  const stories = await allStories();
  const prog = (await KV.get('progress:' + READER.id)) || {};
  const lvls = [1, 2, 3].map(l => [l, stories.filter(s => s.level === l)]).filter(([, a]) => a.length);
  $('#shelves').innerHTML = lvls.map(([l, arr]) => `<div class="shelf-title">${LEVEL_NAMES[l]}</div><div class="shelf">` + arr.map(s => {
    const p = prog[s.id]; const pct = p ? Math.round(((p.page + 1) / s.pages.length) * 100) : 0;
    const img = s.coverImg ? `<img src="${s.coverImg}" alt="">` : esc(s.cover || '📘');
    return `<button class="book" data-id="${s.id}"><span class="cover lvl${s.level}">${img}</span><span class="meta"><span class="t">${esc(s.title)}</span><span class="muted" style="font-size:13px">${s.pages.length} pages${p?.done ? ' · ✓ read' : ''}</span><span class="prog"><i style="width:${p?.done ? 100 : pct}%"></i></span></span></button>`;
  }).join('') + (l === 3 ? '' : '') + `</div>`).join('') +
    `<div class="shelf-title">Add more</div><div class="shelf"><button class="book add" data-act="add-story"><span style="font-size:34px">➕</span>Add a story<span style="font-size:13px">(grown-ups)</span></button></div>`;
  $$('#shelves .book[data-id]').forEach(b => b.onclick = () => openStory(b.dataset.id));
  // continue reading
  const last = Object.entries(prog).filter(([id, p]) => !p.done && stories.find(s => s.id === id)).sort((a, b) => b[1].ts - a[1].ts)[0];
  const cb = $('#continueBtn');
  if (last) { const s = stories.find(s => s.id === last[0]); cb.classList.remove('hidden'); $('#continueTitle').textContent = `${s.title} — page ${last[1].page + 1}`; cb.onclick = () => openStory(s.id); }
  else cb.classList.add('hidden');
  const pw = await practiceWords(50);
  $('#practiceCount').textContent = pw.length ? `${pw.length} word${pw.length > 1 ? 's' : ''} to practice` : 'Practice your words';
  show('library');
}

// ---------- book reader -------------------------------------------------------
const B = { story: null, page: 0, sentences: [] };
const ABBREV = /^(Mr|Mrs|Ms|Dr|St|Jr|Sr|Mt|Prof|Capt|Gen|Lt|Col|Sgt|vs|etc)$/i;
async function openStory(id, page) {
  const s = (await allStories()).find(s => s.id === id); if (!s) return;
  B.story = s;
  const prog = (await KV.get('progress:' + READER.id)) || {};
  B.page = page ?? (prog[id] && !prog[id].done ? prog[id].page : 0);
  $('#bookTitle').textContent = s.title;
  $('#readAloudBtn').classList.toggle('hidden', !(S.recog && Recog.ready));
  logEvent({ type: 'open', storyId: id });
  show('book');
  renderPage();
}
// Build the page DOM. Every word is a span; sentence index lets long-press read the sentence.
function renderPage(dir) {
  const s = B.story, blocks = s.pages[B.page] || [];
  const fs = { 1: 44, 2: 32, 3: 24 }[s.level] || 28;
  const inner = $('#pageInner');
  inner.style.setProperty('--fs', fs + 'px'); inner.style.setProperty('--scale', S.scale);
  B.sentences = []; B.pageWords = [];
  let html = '';
  const addText = (text) => {
    let out = '', cur = '', si = B.sentences.length, startOfSentence = true;
    for (const tk of tokenize(text)) {
      if (tk.w) {
        const proper = /^\p{Lu}/u.test(tk.v) && !startOfSentence && tk.v !== 'I';
        out += `<span class="w" data-s="${si}" data-i="${B.pageWords.length}"${proper ? ' data-p="1"' : ''}>${esc(tk.v)}</span>`;
        B.pageWords.push(tk.v); cur += tk.v; startOfSentence = false;
      } else {
        out += esc(tk.v); cur += tk.v;
        const prev = B.pageWords[B.pageWords.length - 1] || '';
        if (/[.!?]/.test(tk.v) && !(/^\./.test(tk.v.trim()) && ABBREV.test(prev))) { B.sentences[si] = cur.trim(); cur = ''; si++; startOfSentence = true; }
      }
    }
    if (cur.trim()) { B.sentences[si] = cur.trim(); si++; }
    while (B.sentences.length < si) B.sentences.push('');
    return out;
  };
  if (B.page === 0) {
    html += `<div class="title">${addText(s.title)}</div>`;
    if (s.author) html += `<div class="byline">${esc(s.author)}</div>`;
  }
  for (const b of blocks) {
    if (b.t === 'pic') html += `<div class="pic" aria-hidden="true">${esc(b.text)}</div>`;
    else if (b.t === 'img') html += `<img src="${b.src}" alt="${esc(b.alt || '')}">`;
    else if (b.t === 'h') html += `<h2>${addText(b.text)}</h2>`;
    else if (b.t === 'p') html += `<p>${addText(b.text)}</p>`;
  }
  html += `<div class="pageno"><span class="w" data-num="${B.page + 1}" data-s="-1">${B.page + 1}</span></div>`;
  inner.innerHTML = html;
  const pg = $('#page'); pg.scrollTop = 0;
  if (dir) { pg.classList.remove('turn-l', 'turn-r'); void pg.offsetWidth; pg.classList.add(dir < 0 ? 'turn-l' : 'turn-r'); }
  const last = s.pages.length - 1;
  for (const id of ['prevBtn', 'prevBtn2']) $('#' + id).disabled = B.page === 0;
  $('#nextBtn').disabled = false;
  $('#nextBtn2').textContent = B.page === last ? 'The end ✓' : 'Next ›';
  $('#bookProg').style.width = ((B.page + 1) / s.pages.length * 100) + '%';
  saveProgress();
  // Pre-generate audio for this page and the next so taps play instantly with Kokoro.
  const next = (s.pages[B.page + 1] || []).filter(b => b.text && b.t !== 'pic').flatMap(b => b.text.match(WORD_RE) || []);
  TTS.prewarm([...new Set([...B.pageWords, ...next])]);
}
async function saveProgress() {
  const key = 'progress:' + READER.id, prog = (await KV.get(key)) || {};
  const prev = prog[B.story.id] || {};
  const done = prev.done || B.page === B.story.pages.length - 1;
  prog[B.story.id] = { page: B.page, ts: Date.now(), done, maxPage: Math.max(prev.maxPage || 0, B.page) };
  await KV.set(key, prog);
  logEvent({ type: 'page', storyId: B.story.id, page: B.page });
}
function turn(d) {
  const n = B.page + d, last = B.story.pages.length - 1;
  TTS.stop(); clearHighlights();
  if (n < 0) return;
  if (n > last) { finishBook(); return; }
  B.page = n; renderPage(d);
}
async function finishBook() {
  logEvent({ type: 'finish', storyId: B.story.id });
  const prog = (await KV.get('progress:' + READER.id)) || {}; prog[B.story.id] = { ...(prog[B.story.id] || {}), page: 0, done: true, ts: Date.now() }; await KV.set('progress:' + READER.id, prog);
  chime('win'); confetti(innerWidth / 2, innerHeight / 2, 24);
  TTS.say(`The end! Great reading, ${READER.name}!`);
  const pw = await practiceWords(12);
  modal(`<div style="text-align:center"><div style="font-size:64px">🏆</div><h3>You finished ${esc(B.story.title)}!</h3>
    <p class="muted">${pw.length ? `Want to play a game with your ${pw.length} practice words?` : 'Pick another book?'}</p>
    <div class="row" style="justify-content:center;margin-top:16px">${pw.length ? '<button class="btn teal" id="fGame">🎲 Play</button>' : ''}<button class="btn" id="fLib">📚 Books</button></div></div>`,
    (m, close) => { $('#fLib', m).onclick = () => { close(); renderLibrary(); }; if ($('#fGame', m)) $('#fGame', m).onclick = () => { close(); renderGames(); }; });
}
function clearHighlights() { $$('#pageInner .w.say, #pageInner .w.sent').forEach(e => e.classList.remove('say', 'sent')); }

// Tap = say the word, long-press = say the whole sentence.
function wireBook() {
  const inner = $('#pageInner'); let timer = null, longFired = false, downEl = null, downXY = null;
  inner.addEventListener('pointerdown', e => {
    const w = e.target.closest('.w'); if (!w) return;
    audioCtx(); downEl = w; longFired = false; downXY = [e.clientX, e.clientY];
    clearTimeout(timer);
    timer = setTimeout(() => { longFired = true; saySentence(w); }, 520);
  });
  const cancel = () => { clearTimeout(timer); };
  inner.addEventListener('pointermove', e => { if (downXY && Math.hypot(e.clientX - downXY[0], e.clientY - downXY[1]) > 12) { cancel(); downEl = null; } });
  inner.addEventListener('pointercancel', () => { cancel(); downEl = null; });
  inner.addEventListener('pointerup', e => {
    cancel(); const w = e.target.closest('.w');
    if (!w || w !== downEl || longFired) { downEl = null; return; }
    downEl = null; tapWord(w);
  });
  inner.addEventListener('contextmenu', e => e.preventDefault());
  inner.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('w')) { e.preventDefault(); tapWord(e.target); } });
  $('#prevBtn').onclick = $('#prevBtn2').onclick = () => turn(-1);
  $('#nextBtn').onclick = $('#nextBtn2').onclick = () => turn(1);
  $('#readPageBtn').onclick = () => readPage();
  $('#readAloudBtn').onclick = () => readAloud();
  // Swipe to turn pages.
  let sx = null, sy = 0;
  $('#page').addEventListener('touchstart', e => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  $('#page').addEventListener('touchend', e => {
    if (sx == null) return; const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy; sx = null;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) turn(dx < 0 ? 1 : -1);
  });
  addEventListener('keydown', e => {
    if (document.body.dataset.screen !== 'book' || $('#modalRoot').firstChild) return;
    if (e.key === 'ArrowRight') turn(1); if (e.key === 'ArrowLeft') turn(-1);
  });
}
function tapWord(el) {
  el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit'); clearTimeout(el._hit); el._hit = setTimeout(() => el.classList.remove('hit'), 1200);
  const display = el.dataset.num || el.textContent;
  TTS.say(display, { word: true });
  recordTap(display, { storyId: B.story.id, page: B.page, properNoun: el.dataset.p === '1', how: el.closest('.title,h2') ? 'title' : el.dataset.num ? 'pageno' : 'tap' });
}
async function saySentence(el) {
  const si = +el.dataset.s; if (si < 0) return tapWord(el);
  clearHighlights();
  const spans = $$(`#pageInner .w[data-s="${si}"]`); spans.forEach(s => s.classList.add('sent'));
  el.classList.add('say');
  logEvent({ type: 'sentence', storyId: B.story.id, page: B.page });
  await TTS.say(B.sentences[si] || '');
  spans.forEach(s => s.classList.remove('sent')); el.classList.remove('say');
}
async function readPage() {
  audioCtx();
  const btn = $('#readPageBtn');
  if (btn.dataset.on) { TTS.stop(); clearHighlights(); delete btn.dataset.on; btn.textContent = '🔊'; return; }
  btn.dataset.on = 1; btn.textContent = '⏹';
  logEvent({ type: 'readpage', storyId: B.story.id, page: B.page });
  const sents = B.sentences.map((t, i) => ({ t, i })).filter(x => x.t);
  await TTS.sayAll(sents.map(x => x.t), k => { clearHighlights(); $$(`#pageInner .w[data-s="${sents[k].i}"]`).forEach(s => s.classList.add('sent')); });
  clearHighlights(); delete btn.dataset.on; btn.textContent = '🔊';
}
