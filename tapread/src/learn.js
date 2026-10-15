// ===========================================================================
// Learning model: tap log, per-word state, spaced practice
// ===========================================================================
// Every tap / game answer / read-aloud result is an event. Per reader+word we also keep a
// small summary record with a Leitner box (0..5). Tapping a word in a story means
// "I needed help" and puts it back in box 0; a first-try correct answer in a game moves it
// up one box; a miss drops it to box 0. Box 5 = mastered (left out of practice).
const BOX_DAYS = [0, 1, 2, 4, 8, 16];
const HALF_LIFE = 14 * DAY;
let READER = null;          // current reader object

async function logEvent(ev) {
  if (!READER) return;
  return DB.put('events', { readerId: READER.id, ts: Date.now(), ...ev });
}
async function wordRec(word) {
  const key = READER.id + '|' + word;
  return (await DB.get('words', key)) || { key, readerId: READER.id, word, display: word, proper: false, taps: 0, tapLog: [], box: 0, due: 0, correct: 0, wrong: 0, sayRight: 0, sayWrong: 0, readMiss: 0, readHes: 0, readOk: 0, first: Date.now(), last: 0 };
}
async function recordTap(display, ctx = {}) {
  if (!READER) return;
  const word = normWord(display), now = Date.now();
  const r = await wordRec(word);
  r.taps++; r.last = now; r.box = 0; r.due = now;
  r.tapLog = [...(r.tapLog || []), now].slice(-30);
  r.display = ctx.properNoun ? display : word; r.proper = !!ctx.properNoun;
  await DB.put('words', r);
  await logEvent({ type: 'tap', word, storyId: ctx.storyId, page: ctx.page, how: ctx.how || 'tap' });
}
async function recordAnswer(word, kind, extra = {}) {
  // kind: 'right' | 'wrong' | 'say-right' | 'say-wrong' | 'say-unclear' | 'read-ok' | 'read-miss' | 'read-hes' | 'seen'
  if (!READER) return;
  word = normWord(word);
  const r = await wordRec(word), now = Date.now();
  if (kind === 'right' || kind === 'say-right') { r.correct++; if (kind === 'say-right') r.sayRight++; r.box = Math.min(5, r.box + 1); r.due = now + BOX_DAYS[r.box] * DAY; }
  else if (kind === 'wrong' || kind === 'say-wrong') { r.wrong++; if (kind === 'say-wrong') r.sayWrong++; r.box = 0; r.due = now; }
  else if (kind === 'read-miss') { r.readMiss++; r.box = Math.min(r.box, 1); r.due = Math.min(r.due || now, now); }
  else if (kind === 'read-hes') { r.readHes++; }
  else if (kind === 'read-ok') { r.readOk++; }
  // Words only seen in read-aloud that were read fine don't need a record at all.
  if (r.taps || r.correct || r.wrong || r.readMiss || r.readHes || r.sayWrong) await DB.put('words', r);
  await logEvent({ type: kind, word, ...extra });
}
function weight(r, now = Date.now()) {
  const decayed = (r.tapLog || []).reduce((a, t) => a + Math.pow(0.5, (now - t) / HALF_LIFE), 0);
  return decayed + 1.5 * r.wrong + 1.2 * (r.readMiss || 0) + 0.6 * (r.readHes || 0) + (r.sayWrong || 0) - 0.5 * r.correct;
}
async function practiceWords(n = 8) {
  if (!READER) return [];
  const now = Date.now();
  const recs = (await DB.byReader('words', READER.id)).filter(r => r.box < 5 && (r.taps || r.wrong || r.readMiss));
  recs.sort((a, b) => ((b.due <= now) - (a.due <= now)) || (weight(b, now) - weight(a, now)));
  return recs.slice(0, n);
}
// Plausible wrong answers: similar length / same first letter, never homophones.
function distractors(target, pool, k = 3) {
  const t = normWord(target);
  const cands = [...new Set(pool.map(normWord))].filter(w => w && !sameWord(w, t) && w.length > 0 && !/^\d+$/.test(w));
  const scored = cands.map(w => ({ w, s: (w[0] === t[0] ? 2 : 0) + (Math.abs(w.length - t.length) <= 1 ? 2 : 0) + Math.random() * 2.5 }));
  return scored.sort((a, b) => b.s - a.s).slice(0, k).map(x => x.w);
}
async function vocabPool() {
  const words = new Set(SIGHT_WORDS);
  for (const s of await allStories()) {
    let c = 0;
    for (const b of s.pages.flat()) { if (b.text && b.t !== 'pic') for (const w of wordsOf(b.text)) { if (w.length <= 9) words.add(w); if (++c > 3000) break; } }
  }
  if (READER) for (const r of await DB.byReader('words', READER.id)) words.add(r.word);
  return [...words];
}
// Reading time: sum the gaps between consecutive reader events, ignoring gaps > 3 min.
function readingMinutes(events) {
  const ts = events.map(e => e.ts).sort((a, b) => a - b); let ms = 0;
  for (let i = 1; i < ts.length; i++) { const g = ts[i] - ts[i - 1]; if (g < 180000) ms += g; }
  return ms / 60000;
}
