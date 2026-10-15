// ===========================================================================
// Importing stories: plain text, HTML, EPUB
// ===========================================================================
const BLOCK_TAGS = new Set(['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'BLOCKQUOTE', 'PRE', 'DD', 'DT', 'FIGCAPTION', 'TD']);
const clean = s => s.replace(/\s+/g, ' ').trim();

// Walk a document body and produce flat blocks. resolveImg(src) -> data URL | null (may be async).
async function htmlToBlocks(root, resolveImg) {
  const blocks = [];
  const walk = async el => {
    for (const node of el.childNodes) {
      if (node.nodeType !== 1) continue;
      const tag = node.tagName.toUpperCase();
      if (['SCRIPT', 'STYLE', 'NAV', 'HEADER', 'FOOTER', 'NOSCRIPT', 'SVG', 'TEMPLATE', 'HEAD'].includes(tag)) continue;
      if (tag === 'IMG' || tag === 'IMAGE') {
        const src = node.getAttribute('src') || node.getAttribute('xlink:href') || node.getAttribute('href');
        const url = src && resolveImg ? await resolveImg(src) : null;
        if (url) blocks.push({ t: 'img', src: url, alt: node.getAttribute('alt') || '' });
        continue;
      }
      if (BLOCK_TAGS.has(tag)) {
        if (node.querySelector('img,image')) for (const im of node.querySelectorAll('img,image')) {
          const src = im.getAttribute('src') || im.getAttribute('xlink:href') || im.getAttribute('href');
          const url = src && resolveImg ? await resolveImg(src) : null;
          if (url) blocks.push({ t: 'img', src: url, alt: im.getAttribute('alt') || '' });
        }
        const text = clean(node.textContent || '');
        if (text) blocks.push({ t: /^H[1-6]$/.test(tag) ? 'h' : 'p', text, lvl: /^H[1-6]$/.test(tag) ? +tag[1] : 0 });
        continue;
      }
      // a DIV that only contains text acts like a paragraph
      if (tag === 'DIV' && ![...node.children].some(c => BLOCK_TAGS.has(c.tagName.toUpperCase()) || c.tagName.toUpperCase() === 'DIV' || c.tagName.toUpperCase() === 'IMG')) {
        const text = clean(node.textContent || ''); if (text) blocks.push({ t: 'p', text }); continue;
      }
      await walk(node);
    }
  };
  await walk(root);
  return blocks;
}

// Cut Project Gutenberg front and back matter.
function stripGutenberg(blocks) {
  const s = blocks.findIndex(b => /\*\*\*\s*START OF (THE|THIS) PROJECT GUTENBERG/i.test(b.text || ''));
  const e = blocks.findIndex(b => /\*\*\*\s*END OF (THE|THIS) PROJECT GUTENBERG/i.test(b.text || ''));
  let out = blocks;
  if (e > 0) out = out.slice(0, e);
  if (s >= 0) out = out.slice(s + 1);
  return out.filter(b => !/project gutenberg/i.test(b.text || '') || countWords(b.text) > 60);
}

function finishImport({ title, author, blocks, cover }) {
  blocks = stripGutenberg(blocks);
  // A run of headings at the start (title page) collapses into the title.
  const h = blocks.filter(b => b.t === 'h');
  if (!title) title = h[0]?.text || 'My story';
  // Drop headings that just repeat the title, and promote only top-level-ish headings to chapter breaks.
  const minLvl = Math.min(...h.map(b => b.lvl || 2), 9);
  blocks = blocks.filter(b => !(b.t === 'h' && clean(b.text).toLowerCase() === clean(title).toLowerCase()));
  blocks = blocks.map(b => b.t === 'h' && (b.lvl || 2) > minLvl + 1 ? { t: 'p', text: b.text } : b);
  const pages = paginate(blocks.filter(b => b.t !== 'break' || true));
  if (!pages.length) throw new Error('No readable text was found in that file.');
  return { id: 'u-' + uid(), title: clean(title).slice(0, 120), author: author ? clean(author).slice(0, 120) : '', level: guessLevel(pages), cover: '📗', coverImg: cover || null, pages, added: Date.now() };
}

async function importText(raw, name) {
  const st = storyFromScript({ text: raw.replace(/\r\n?/g, '\n'), title: '' });
  if (!st.title || st.title === 'My story') st.title = (name || 'My story').replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');
  // Strip Gutenberg boilerplate from plain-text books too.
  if (/PROJECT GUTENBERG/i.test(raw)) {
    const body = raw.split(/\*\*\*\s*START OF (?:THE|THIS) PROJECT GUTENBERG[^\n]*\n/i).pop().split(/\*\*\*\s*END OF (?:THE|THIS) PROJECT GUTENBERG/i)[0];
    const t = raw.match(/^Title:\s*(.+)$/m)?.[1], a = raw.match(/^Author:\s*(.+)$/m)?.[1];
    const paras = body.replace(/\r\n?/g, '\n').split(/\n\s*\n/).map(clean).filter(Boolean);
    const blocks = paras.map(p => /^(CHAPTER|Chapter)\s+[\dIVXLC]+\b/.test(p) && countWords(p) < 14 ? { t: 'h', text: p } : { t: 'p', text: p });
    return finishImport({ title: t || st.title, author: a, blocks });
  }
  return st;
}

async function importHTML(raw, name) {
  const doc = new DOMParser().parseFromString(raw, 'text/html');
  const imgs = src => /^(data:image|https?:)/i.test(src) ? src : null;
  const blocks = await htmlToBlocks(doc.body, imgs);
  return finishImport({ title: doc.querySelector('title')?.textContent || (name || '').replace(/\.[^.]+$/, ''), author: doc.querySelector('meta[name=author]')?.content, blocks });
}

let JSZipLoad = null;
function loadJSZip() {
  return JSZipLoad ||= new Promise((res, rej) => {
    if (window.JSZip) return res(window.JSZip);
    const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
    s.onload = () => res(window.JSZip); s.onerror = () => { JSZipLoad = null; rej(new Error('Could not load the EPUB reader (JSZip).')); };
    document.head.appendChild(s);
  });
}
const resolvePath = (base, rel) => {
  rel = decodeURIComponent(rel.split('#')[0]);
  const parts = (base.includes('/') ? base.slice(0, base.lastIndexOf('/') + 1) : '').concat(rel).split('/');
  const out = []; for (const p of parts) { if (p === '..') out.pop(); else if (p && p !== '.') out.push(p); }
  return out.join('/');
};
function parseXML(text, type = 'application/xml') {
  let d = new DOMParser().parseFromString(text, type);
  if (d.querySelector('parsererror')) d = new DOMParser().parseFromString(text, 'text/html');
  return d;
}
async function importEPUB(file) {
  const JSZip = await loadJSZip();
  const zip = await JSZip.loadAsync(file);
  const read = p => zip.file(p)?.async('string');
  const container = parseXML(await read('META-INF/container.xml') || '');
  const opfPath = container.querySelector('rootfile')?.getAttribute('full-path');
  if (!opfPath) throw new Error('This EPUB is missing its table of contents (OPF).');
  const opf = parseXML(await read(opfPath));
  const pick = sel => [...opf.getElementsByTagName('*')].find(e => e.localName === sel)?.textContent;
  const title = pick('title'), author = pick('creator');
  const manifest = {};
  for (const it of [...opf.getElementsByTagName('*')].filter(e => e.localName === 'item')) manifest[it.getAttribute('id')] = { href: resolvePath(opfPath, it.getAttribute('href')), type: it.getAttribute('media-type'), props: it.getAttribute('properties') || '' };
  const spine = [...opf.getElementsByTagName('*')].filter(e => e.localName === 'itemref' && e.getAttribute('linear') !== 'no').map(e => manifest[e.getAttribute('idref')]).filter(Boolean);
  const coverId = [...opf.getElementsByTagName('*')].find(e => e.localName === 'meta' && e.getAttribute('name') === 'cover')?.getAttribute('content');
  const coverItem = Object.values(manifest).find(m => m.props.includes('cover-image')) || manifest[coverId];
  const imgCache = new Map();
  const toDataURL = async path => {
    if (imgCache.has(path)) return imgCache.get(path);
    const f = zip.file(path); if (!f) return null;
    const b64 = await f.async('base64');
    if (b64.length > 2.5e6) return null;      // skip huge images (~1.8 MB)
    const ext = path.split('.').pop().toLowerCase();
    const mime = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', svg: 'image/svg+xml', webp: 'image/webp' }[ext] || 'image/*';
    const url = `data:${mime};base64,${b64}`; imgCache.set(path, url); return url;
  };
  const blocks = [];
  for (const item of spine) {
    if (!/x?html/.test(item.type || 'html')) continue;
    const doc = parseXML(await read(item.href) || '', 'application/xhtml+xml');
    const body = doc.querySelector('body') || doc.documentElement;
    const b = await htmlToBlocks(body, src => /^data:/.test(src) ? src : toDataURL(resolvePath(item.href, src)));
    if (!b.length) continue;
    if (!b.some(x => x.text && countWords(x.text) > 0) && !b.some(x => x.t === 'img')) continue;
    blocks.push({ t: 'break' }, ...b);
  }
  // A leading image-only section that is just the cover duplicates the cover tile; drop it.
  const cover = coverItem ? await toDataURL(coverItem.href) : null;
  const firstText = blocks.findIndex(b => b.text);
  const cleaned = blocks.filter((b, i) => !(b.t === 'img' && i < firstText && cover && b.src === cover));
  return finishImport({ title, author, blocks: cleaned, cover });
}

async function importFile(file) {
  const name = file.name || 'story';
  if (/\.epub$/i.test(name) || file.type === 'application/epub+zip') return importEPUB(file);
  const text = await file.text();
  if (/\.x?html?$/i.test(name) || /^\s*<(!doctype|html)/i.test(text)) return importHTML(text, name);
  return importText(text, name);
}
async function saveImported(story) {
  await DB.put('stories', story); STORY_CACHE = null;
  return story;
}
