// Tap & Read leveling: decide the band (0–7) of words and stories.
// Usage: const L = makeLeveler(scope, dict); L.wordBand('ship'); L.scoreStory(pages, { names })
// dict: Map lowercase word -> array of pronunciations, each an array of CMU phonemes with stress ('SH','IH1','P').

function makeLeveler(scope, dict) {
  const { LEVELS, GRAPHEMES, VCE, SCHWA_BAND, SILENT_FINAL_E_BAND, COMPOUND_BAND, SIGHT } = scope;
  const VOWELS = new Set(['AA','AE','AH','AO','AW','AY','EH','ER','EY','IH','IY','OW','OY','UH','UW']);
  const base = p => p.replace(/\d$/, '');
  const stress = p => (p.match(/\d$/) || [''])[0];
  const isVowelLetter = c => 'aeiou'.includes(c);

  // Graphemes indexed by first letter, with sounds split into phoneme arrays.
  const G = {};
  for (const [g, sounds, band] of GRAPHEMES) (G[g[0]] ||= []).push({ g, ph: sounds.split(' '), band });

  // Can `spelling` produce pronunciation `pron` using patterns taught up to `band`?
  function decodable(spelling, pron, band) {
    const memo = new Map();
    const n = spelling.length, m = pron.length;
    const matchSeq = (j, ph) => {          // does pron[j..] start with ph (ignoring stress)?
      if (j + ph.length > m) return false;
      for (let k = 0; k < ph.length; k++) if (base(pron[j + k]) !== ph[k]) return false;
      return true;
    };
    const go = (i, j) => {
      if (i === n) return j === m;
      const key = i * 64 + j; if (memo.has(key)) return memo.get(key);
      memo.set(key, false);
      let ok = false;
      for (const e of G[spelling[i]] || []) {
        if (e.band > band || !spelling.startsWith(e.g, i)) continue;
        if (matchSeq(j, e.ph) && go(i + e.g.length, j + e.ph.length)) { ok = true; break; }
      }
      // Silent e: V + consonant + e (+ end of word or s/d/r/ly/ful/ness/ment)
      if (!ok && band >= VCE.band && VCE.long[spelling[i]] && i + 2 < n && spelling[i + 2] === 'e'
          && !isVowelLetter(spelling[i + 1]) && /^(|s|d|r|ly|ful|ness|ment|less)$/.test(spelling.slice(i + 3))) {
        for (const lv of VCE.long[spelling[i]]) {
          const lph = lv.split(' ');
          if (!matchSeq(j, lph)) continue;
          for (const c of G[spelling[i + 1]] || []) {
            if (c.g.length !== 1 || c.band > band) continue;
            if (matchSeq(j + lph.length, c.ph) && go(i + 3, j + lph.length + c.ph.length)) { ok = true; break; }
          }
          if (ok) break;
        }
      }
      // Final silent e (house, cheese, give), only when the word has another vowel letter
      if (!ok && band >= SILENT_FINAL_E_BAND && i === n - 1 && spelling[i] === 'e' && /[aeiouy]/.test(spelling.slice(0, i)))
        ok = j === m;
      // Schwa: an unstressed vowel letter read as AH0/IH0 (from SCHWA_BAND)
      if (!ok && band >= SCHWA_BAND && isVowelLetter(spelling[i]) && j < m && stress(pron[j]) === '0' && ['AH','IH'].includes(base(pron[j])))
        ok = go(i + 1, j + 1);
      memo.set(key, ok);
      return ok;
    };
    return go(0, 0);
  }

  const cache = new Map();
  // [pattern, stem candidates, band the ending is taught]
  const INFLECTIONS = [
    [/^(.+?)s$/, s => [s], 1], [/^(.+?)es$/, s => [s], 3], [/^(.+?)'s$/, s => [s], 1],
    [/^(.+?)ed$/, s => [s, s + 'e', s.replace(/(.)\1$/, '$1')], 4], [/^(.+?)ing$/, s => [s, s + 'e', s.replace(/(.)\1$/, '$1')], 4],
    [/^(.+?)er$/, s => [s, s + 'e', s.replace(/(.)\1$/, '$1')], 4], [/^(.+?)ly$/, s => [s], 6],
  ];
  // Lowest band where the word is decodable or a taught sight word; 7 if neither (or unknown).
  function wordBand(word) {
    const w = word.toLowerCase().replace(/’/g, "'");
    if (cache.has(w)) return cache.get(w);
    let best = 7;
    if (w in SIGHT) best = SIGHT[w];
    const prons = dict.get(w) || [];
    const spelling = w.replace(/[^a-z]/g, '');
    for (let b = 0; b < Math.min(best, 7); b++) {
      if (prons.some(p => decodable(spelling, p, b))) { best = b; break; }
    }
    // Consonant blends (fr-, -mp, st-) are taught in band 3, even though each letter is known earlier.
    if (best < 3 && !(w in SIGHT && SIGHT[w] === best) && /[bcdfghjklmnpqrstvwxz]{2}/.test(spelling.replace(/ff|ll|ss|zz|qu/g, '_'))) best = 3;
    // Endings on a known base word: base band, but at least the ending's band.
    cache.set(w, best);
    for (const [re, add, suffixBand] of INFLECTIONS) {
      const m = w.match(re); if (!m) continue;
      for (const stem of add(m[1])) {
        if (stem.length < 2 || stem === w || !(dict.has(stem) || stem in SIGHT)) continue;
        best = Math.min(best, Math.max(wordBand(stem), suffixBand));
      }
    }
    // Compound words: two known words joined (sunset, lighthouse, someone).
    if (best > COMPOUND_BAND && spelling.length >= 6) {
      for (let k = 3; k <= spelling.length - 3; k++) {
        const a = spelling.slice(0, k), b = spelling.slice(k);
        if (!(dict.has(a) || a in SIGHT) || !(dict.has(b) || b in SIGHT)) continue;
        const ba = wordBand(a), bb = wordBand(b);
        if (ba < 7 && bb < 7) best = Math.min(best, Math.max(ba, bb, COMPOUND_BAND));
      }
    }
    cache.set(w, best);
    return best;
  }

  const WORD_RE = /[A-Za-z]+(?:['’][A-Za-z]+)*/g;
  const pct = (arr, q) => { if (!arr.length) return 0; const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };

  // pages: array of page strings. names: words to exempt (character names).
  // Proper nouns are also detected automatically: capitalized, not sentence-initial, never seen lowercase.
  function scoreStory(pages, { names = [], title = '' } = {}) {
    const all = pages.join('\n');
    const lowerSeen = new Set((all.match(WORD_RE) || []).filter(w => w === w.toLowerCase()).map(w => w.toLowerCase()));
    const capsMid = new Set();
    for (const sent of all.split(/(?<=[.!?:]["'”’]?)\s+|\n+|["“”]/))
      (sent.match(WORD_RE) || []).slice(1).forEach(w => { if (/^[A-Z][a-z]/.test(w) && !(w.toLowerCase() in SIGHT)) capsMid.add(w.toLowerCase().replace(/['’]s$/, '')); });
    const exempt = new Set(names.map(n => n.toLowerCase()));
    for (const w of capsMid) if (!lowerSeen.has(w)) exempt.add(w);

    const tokens = [], pageOf = [], perPage = [], perSentence = [];
    pages.forEach((page, pi) => {
      const ws = page.match(WORD_RE) || [];
      perPage.push(ws.length);
      for (const s of page.split(/(?<=[.!?])\s+/)) { const k = (s.match(WORD_RE) || []).length; if (k) perSentence.push(k); }
      for (const w of ws) { const lw = w.toLowerCase(); if (w === 'I') { tokens.push('i'); pageOf.push(pi); } else if (!exempt.has(lw.replace(/['’]s$/, ''))) { tokens.push(lw); pageOf.push(pi); } }
    });
    const bands = tokens.map(wordBand);
    const share = b => bands.filter(x => x <= b).length / Math.max(1, bands.length);
    // New tricky words per page: out-of-level words, counted only the first time they appear.
    const trickyPerPage = b => { const seen = new Set(); let n = 0; tokens.forEach((w, i) => { if (bands[i] > b && !seen.has(w)) { seen.add(w); n++; } }); return n / Math.max(1, pages.length); };
    const pagesP90 = pct(perPage, 0.9), sentP90 = pct(perSentence, 0.9);
    let band = 7, why = {};
    for (const L of LEVELS) {
      const s = share(L.band), t = trickyPerPage(L.band);
      const fitsText = pagesP90 <= L.limits.wordsPerPage && sentP90 <= L.limits.wordsPerSentence;
      why[L.band] = { decodable: +s.toFixed(3), trickyPerPage: +t.toFixed(2), fitsText };
      if (s >= L.floor && t <= L.newTrickyPerPage && fitsText) { band = L.band; break; }
    }
    // Words that kept the story out of the band below (most frequent first)
    const below = band - 1, blockers = {}, tricky = {};
    if (below >= 0) tokens.forEach((w, i) => { if (bands[i] > below) blockers[w] = (blockers[w] || 0) + 1; });
    tokens.forEach((w, i) => { if (bands[i] > band) tricky[w] = (tricky[w] || 0) + 1; });
    return {
      band, level: band + 1, color: LEVELS[band].color,
      words: tokens.length, unique: new Set(tokens).size, names: [...exempt],
      wordsPerPageP90: pagesP90, wordsPerSentenceP90: sentP90, byBand: why,
      tricky: Object.keys(tricky).map(w => `${w}(${wordBand(w) + 1})`),
      blockers: Object.entries(blockers).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([w, c]) => `${w}(${wordBand(w) + 1})${c > 1 ? '×' + c : ''}`),
    };
  }

  return { wordBand, decodable, scoreStory };
}

// Parse CMU dict text: "word(2) P R AH0 N" lines.
function parseCMU(text) {
  const d = new Map();
  for (const line of text.split('\n')) {
    if (!line || line.startsWith(';;;')) continue;
    const parts = line.split(' ').filter(Boolean);
    const w = parts[0].replace(/\(\d+\)$/, ''), pron = [];
    for (const p of parts.slice(1)) { if (p.startsWith('#')) break; pron.push(p); }
    if (!d.has(w)) d.set(w, []);
    d.get(w).push(pron);
  }
  return d;
}

if (typeof module !== 'undefined') module.exports = { makeLeveler, parseCMU };
