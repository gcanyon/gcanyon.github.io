// ===========================================================================
// Core: helpers, storage, settings, text handling
// ===========================================================================
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const DAY = 864e5;

function toast(msg, ms = 2200) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('on'), ms);
}

// ---------- IndexedDB ------------------------------------------------------
const DB = {
  db: null,
  open() {
    return new Promise((res, rej) => {
      const r = indexedDB.open('tapread', 1);
      r.onupgradeneeded = () => {
        const d = r.result;
        d.createObjectStore('kv');
        d.createObjectStore('readers', { keyPath: 'id' });
        d.createObjectStore('stories', { keyPath: 'id' });
        d.createObjectStore('events', { keyPath: 'id', autoIncrement: true }).createIndex('reader', 'readerId');
        d.createObjectStore('words', { keyPath: 'key' }).createIndex('reader', 'readerId');
        d.createObjectStore('audio');
      };
      r.onsuccess = () => { this.db = r.result; res(); };
      r.onerror = () => rej(r.error);
    });
  },
  tx(store, mode, fn) {
    return new Promise((res, rej) => {
      const t = this.db.transaction(store, mode), s = t.objectStore(store);
      let out; const r = fn(s);
      if (r && 'onsuccess' in r) r.onsuccess = () => { out = r.result; };
      t.oncomplete = () => res(out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
    });
  },
  get(s, k) { return this.tx(s, 'readonly', st => st.get(k)); },
  put(s, v, k) { return this.tx(s, 'readwrite', st => k === undefined ? st.put(v) : st.put(v, k)); },
  del(s, k) { return this.tx(s, 'readwrite', st => st.delete(k)); },
  all(s) { return this.tx(s, 'readonly', st => st.getAll()); },
  byReader(s, id) { return this.tx(s, 'readonly', st => st.index('reader').getAll(id)); },
  clear(s) { return this.tx(s, 'readwrite', st => st.clear()); },
  async delByReader(s, id) {
    return this.tx(s, 'readwrite', st => {
      const c = st.index('reader').openCursor(IDBKeyRange.only(id));
      c.onsuccess = () => { const cur = c.result; if (cur) { cur.delete(); cur.continue(); } };
    });
  },
};
const KV = { get: k => DB.get('kv', k), set: (k, v) => DB.put('kv', v, k) };

// ---------- settings -------------------------------------------------------
const DEFAULT_SETTINGS = {
  engine: 'system',          // 'system' | 'kokoro'
  sysVoice: '',              // voiceURI
  rate: 0.9,
  kokoroVoice: 'af_heart',
  kokoroWanted: false,       // load Kokoro automatically at startup
  recog: false,              // experimental Whistle features
  overrides: { },            // word -> how to say it
  scale: 1,
  wordsPerPage: 90,
};
let S = { ...DEFAULT_SETTINGS };
async function loadSettings() { S = { ...DEFAULT_SETTINGS, ...(await KV.get('settings') || {}) }; }
function saveSettings() { return KV.set('settings', S); }

// ---------- text -----------------------------------------------------------
const WORD_RE = /[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu;
function tokenize(text) {
  const out = []; let last = 0;
  for (const m of text.matchAll(WORD_RE)) {
    if (m.index > last) out.push({ w: false, v: text.slice(last, m.index) });
    out.push({ w: true, v: m[0] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ w: false, v: text.slice(last) });
  return out;
}
const normWord = w => String(w).toLowerCase().replace(/’/g, "'").replace(/^['\-]+|['\-]+$/g, '');
const wordsOf = text => (String(text).match(WORD_RE) || []).map(normWord);
const countWords = text => (String(text).match(WORD_RE) || []).length;

const ONES = 'zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen'.split(' ');
const TENS = ',,twenty,thirty,forty,fifty,sixty,seventy,eighty,ninety'.split(',');
function numToWords(n) {
  n = Math.floor(Number(n));
  if (!isFinite(n) || n < 0 || n > 999999) return String(n);
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : '');
  if (n < 1000) return ONES[Math.floor(n / 100)] + ' hundred' + (n % 100 ? ' ' + numToWords(n % 100) : '');
  return numToWords(Math.floor(n / 1000)) + ' thousand' + (n % 1000 ? ' ' + numToWords(n % 1000) : '');
}
// What actually gets sent to the speech engine.
function speakable(text) {
  return String(text).replace(WORD_RE, w => {
    const k = normWord(w);
    if (S.overrides[k]) return S.overrides[k];
    if (/^\d+$/.test(w)) return numToWords(w);
    return w;
  });
}

const HOMOPHONES = ['to two too','there their they\'re','for four fore','ate eight','no know','see sea','son sun','right write','hear here','one won','i eye','be bee','blue blew','by buy bye','deer dear','flower flour','hole whole','knight night','made maid','meat meet','pair pear','read red','road rode','sail sale','tail tale','wait weight','week weak','wood would','which witch','hare hair','its it\'s','your you\'re','new knew','not knot','so sew','way weigh','tide tied','toe tow','whole hole','some sum','would wood','our hour','be bee','peace piece','plane plain','rain reign','sent cent scent','threw through','wear where']
  .reduce((m, g) => { const ws = g.split(' '); ws.forEach(w => m[w] = new Set(ws)); return m; }, {});
function sameWord(a, b) {
  a = normWord(a); b = normWord(b);
  if (/^\d+$/.test(a)) a = numToWords(a); if (/^\d+$/.test(b)) b = numToWords(b);
  if (a === b) return true;
  if (HOMOPHONES[a]?.has(b)) return true;
  const strip = w => w.replace(/'s$/, '').replace(/(?<=..)(es|s)$/, '');
  return strip(a) === strip(b);
}

// ---------- story parsing ---------------------------------------------------
// A story is { id, title, author, level, cover, pages: [[block]] }
// block: {t:'h', text} | {t:'p', text} | {t:'pic', text} | {t:'img', src, alt}
function parseScript(raw) {
  const pages = [];
  for (const chunk of raw.replace(/\r\n?/g, '\n').split(/^\s*(?:={3,}|-{3,}|\f|\[page\])\s*$/m)) {
    const blocks = [];
    for (const para of chunk.split(/\n\s*\n/)) {
      const lines = para.split('\n').map(l => l.trim()).filter(Boolean);
      let buf = [];
      const flush = () => { if (buf.length) blocks.push({ t: 'p', text: buf.join(' ') }); buf = []; };
      for (const l of lines) {
        if (l.startsWith('@pic ')) { flush(); blocks.push({ t: 'pic', text: l.slice(5).trim() }); }
        else if (/^#{1,3}\s/.test(l)) { flush(); blocks.push({ t: l.startsWith('# ') ? 'title' : 'h', text: l.replace(/^#+\s*/, '') }); }
        else buf.push(l);
      }
      flush();
    }
    if (blocks.length) pages.push(blocks);
  }
  return pages;
}

// Split a flat block list into pages: chapter headings start a page, and long runs
// of paragraphs are broken at roughly `target` words (never mid-sentence).
function paginate(blocks, target = S.wordsPerPage) {
  const pages = []; let cur = [], n = 0;
  const push = () => { if (cur.length) pages.push(cur); cur = []; n = 0; };
  for (const b of blocks) {
    if (b.t === 'h' || b.t === 'break') { push(); if (b.t === 'h') cur.push(b); continue; }
    if (b.t === 'img' || b.t === 'pic') { if (n > target * 0.6) push(); cur.push(b); n += target * 0.35; continue; }
    const wc = countWords(b.text);
    if (n && n + wc > target) push();
    if (wc > target * 1.4) {               // split a very long paragraph by sentences
      const sents = b.text.match(/[^.!?]+[.!?]+["'’”)]*\s*|[^.!?]+$/g) || [b.text];
      let acc = '';
      for (const s of sents) {
        if (acc && countWords(acc + s) > target) { cur.push({ t: 'p', text: acc.trim() }); push(); acc = ''; }
        acc += s;
      }
      if (acc.trim()) { cur.push({ t: 'p', text: acc.trim() }); n += countWords(acc); }
    } else { cur.push(b); n += wc; }
  }
  push();
  return pages;
}
function guessLevel(pages) {
  const words = pages.flat().filter(b => b.t === 'p').reduce((a, b) => a + countWords(b.text), 0);
  const per = words / Math.max(1, pages.length);
  return per <= 12 ? 1 : per <= 45 ? 2 : 3;
}
function storyFromScript(meta) {
  let pages = parseScript(meta.text);
  let title = meta.title;
  const tb = pages[0]?.findIndex(b => b.t === 'title');
  if (tb >= 0) { title = title || pages[0][tb].text; pages[0].splice(tb, 1); if (!pages[0].length) pages.shift(); }
  const explicit = /^\s*(?:={3,}|-{3,}|\f|\[page\])\s*$/m.test(meta.text);
  if (!explicit) pages = paginate(pages.flat());
  return { id: meta.id || 'u-' + uid(), title: title || 'My story', author: meta.author || '', level: meta.level || guessLevel(pages), cover: meta.cover || '📘', builtin: !!meta.builtin, pages, added: Date.now() };
}
