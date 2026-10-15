// ===========================================================================
// Games — all built from the reader's weighted practice list
// ===========================================================================
const STARTERS = ['the', 'said', 'was', 'here', 'look', 'come', 'where', 'what', 'they', 'you'];
let GAME = null;

async function gameWords(n) {
  const recs = await practiceWords(n);
  const words = recs.map(r => ({ word: r.word, display: r.proper ? r.display : r.word }));
  const starter = words.length < 3;
  if (starter) for (const w of shuffle(STARTERS)) { if (words.length >= Math.min(n, 6)) break; if (!words.find(x => x.word === w)) words.push({ word: w, display: w }); }
  return { words, starter };
}

async function renderGames() {
  const { words, starter } = await gameWords(12);
  $('#gamesNote').textContent = starter
    ? 'Tap words you don’t know while reading, and they’ll show up here. For now, here are some starter words.'
    : `Playing with ${words.length} of your words: ${words.slice(0, 6).map(w => w.display).join(', ')}${words.length > 6 ? '…' : ''}`;
  const tiles = [
    { id: 'find', e: '👂', t: 'Listen & Find', d: 'Hear a word, tap the right one.', c: 'lvl2' },
    { id: 'match', e: '🃏', t: 'Memory Match', d: 'Match each word to its sound.', c: 'lvl3' },
  ];
  if (S.recog) tiles.push({ id: 'say', e: '🎤', t: 'Say It!', d: Recog.ready ? 'See a word, say it out loud.' : 'Needs speech recognition — tap to load it.', c: 'lvl1' });
  $('#gameTiles').innerHTML = tiles.map(g => `<button class="game-tile ${g.c}" data-g="${g.id}"><span class="e">${g.e}</span><b>${g.t}</b><span class="muted">${g.d}</span></button>`).join('');
  $$('#gameTiles [data-g]').forEach(b => b.onclick = () => startGame(b.dataset.g));
  show('games');
}

async function startGame(kind) {
  audioCtx();
  if (kind === 'say' && !Recog.ready) {
    const ok = await loadRecogWithModal(); if (!ok) return;
  }
  const { words } = await gameWords(kind === 'match' ? 6 : 8);
  GAME = { kind, words: shuffle(words), i: 0, stars: 0, firstTry: true, pool: await vocabPool(), alive: true };
  $('#gameTitle').textContent = { find: 'Listen & Find', match: 'Memory Match', say: 'Say It!' }[kind];
  $('#gameStars').textContent = '';
  logEvent({ type: 'game', game: kind });
  show('game');
  if (kind === 'find') findRound(); else if (kind === 'match') matchGame(); else sayRound();
}
function addStar() { GAME.stars++; $('#gameStars').textContent = '⭐'.repeat(Math.min(GAME.stars, 10)); }
function endGame(msg) {
  if (!GAME) return; GAME.alive = false; chime('win'); confetti(innerWidth / 2, innerHeight / 2, 24);
  TTS.say(msg || `You did it, ${READER.name}!`);
  $('#gameArea').innerHTML = `<div style="font-size:80px">🏆</div><div class="feedback">${esc(msg || 'You did it!')}</div><div class="stars">${'⭐'.repeat(Math.max(1, GAME.stars))}</div>
    <div class="row"><button class="btn teal" id="again">Play again</button><button class="btn" id="toGames">More games</button></div>`;
  $('#again').onclick = () => startGame(GAME.kind); $('#toGames').onclick = renderGames;
}

// ---- Listen & Find ----
function findRound() {
  const g = GAME; if (!g.alive) return;
  if (g.i >= g.words.length) return endGame(`Great listening, ${READER.name}!`);
  const target = g.words[g.i]; g.firstTry = true;
  const opts = shuffle([target.display, ...distractors(target.word, g.pool, 3)]);
  $('#gameArea').innerHTML = `<button class="speaker" id="hear" title="Hear it again">🔊</button>
    <div class="feedback" id="fb">Which word did you hear?</div>
    <div class="choices">${opts.map(o => `<button class="choice" data-w="${esc(o)}">${esc(o)}</button>`).join('')}</div>
    <div class="muted">${g.i + 1} of ${g.words.length}</div>`;
  const hear = () => TTS.say(target.display, { word: true });
  $('#hear').onclick = hear; setTimeout(hear, 350);
  $$('.choice').forEach(b => b.onclick = async () => {
    if (!g.alive || b.classList.contains('wrong')) return;
    if (sameWord(b.dataset.w, target.word)) {
      b.classList.add('right'); chime('good'); const r = b.getBoundingClientRect(); confetti(r.left + r.width / 2, r.top);
      if (g.firstTry) { addStar(); recordAnswer(target.word, 'right', { game: 'find' }); }
      $('#fb').textContent = praise();
      $$('.choice').forEach(c => c.disabled = true);
      await TTS.say($('#fb').textContent); await sleep(500);
      g.i++; findRound();
    } else {
      b.classList.add('wrong'); chime('oops');
      if (g.firstTry) recordAnswer(target.word, 'wrong', { game: 'find', picked: normWord(b.dataset.w) });
      g.firstTry = false;
      $('#fb').textContent = `That one says “${b.dataset.w}”. Listen again!`;
      await TTS.say(b.dataset.w, { word: true }); await sleep(250); if (g.alive) hear();
    }
  });
}

// ---- Memory Match: a word card and a speaker card for each word ----
function matchGame() {
  const g = GAME, words = g.words.slice(0, innerWidth < 500 ? 4 : 6);
  const cards = shuffle(words.flatMap((w, k) => [{ k, w, type: 'word' }, { k, w, type: 'sound' }]));
  const cols = cards.length <= 8 ? 4 : innerWidth < 500 ? 3 : 4;
  $('#gameArea').innerHTML = `<div class="feedback" id="fb">Find the word that matches the sound!</div>
    <div class="mem-grid" style="--cols:${cols}">${cards.map((c, i) => `<button class="mem" data-i="${i}"><span class="b">?</span><span class="f">${c.type === 'word' ? esc(c.w.display) : '🔊'}</span></button>`).join('')}</div>`;
  let up = [], lock = false, found = 0, tries = {};
  $$('.mem').forEach(el => el.onclick = async () => {
    if (lock || el.classList.contains('up') || el.classList.contains('done') || !g.alive) return;
    const c = cards[+el.dataset.i]; el.classList.add('up'); chime('flip');
    if (c.type === 'sound') TTS.say(c.w.display, { word: true });
    up.push([el, c]);
    if (up.length < 2) return;
    lock = true;
    const [[e1, c1], [e2, c2]] = up; up = [];
    if (c1.k === c2.k && c1.type !== c2.type) {
      await sleep(400); e1.classList.add('done'); e2.classList.add('done'); chime('good'); addStar(); found++;
      const r = e2.getBoundingClientRect(); confetti(r.left + r.width / 2, r.top + r.height / 2, 8);
      await TTS.say(c1.w.display, { word: true });
      recordAnswer(c1.w.word, (tries[c1.k] || 0) <= 2 ? 'right' : 'seen', { game: 'match' });
      lock = false;
      if (found === words.length) setTimeout(() => endGame(`You matched them all!`), 600);
    } else {
      tries[c1.k] = (tries[c1.k] || 0) + 1; tries[c2.k] = (tries[c2.k] || 0) + 1;
      await sleep(1100); e1.classList.remove('up'); e2.classList.remove('up'); lock = false;
    }
  });
}

// ---- Say It! (Whistle) ----
async function sayRound() {
  const g = GAME; if (!g.alive) return;
  if (g.i >= g.words.length) { Recog.closeMic(); return endGame(`Great talking, ${READER.name}!`); }
  const target = g.words[g.i]; g.tries = g.tries || 0;
  $('#gameArea').innerHTML = `<div class="prompt-word">${esc(target.display)}</div>
    <div class="feedback" id="fb">${g.i === 0 && !g.tries ? 'Tap the microphone and say this word.' : 'Can you say this word?'}</div>
    <button class="mic" id="mic" title="Tap and say the word">🎤</button><div class="meter"><i id="lvl"></i></div>
    <div class="row"><button class="btn small" id="help">🔊 Help me</button><button class="btn small ghost" id="skip">Skip ›</button></div>`;
  if (g.i === 0 && !g.tries) TTS.say('Tap the microphone and say the word.');
  $('#help').onclick = () => { TTS.say(target.display, { word: true }); };
  $('#skip').onclick = () => { g.i++; g.tries = 0; sayRound(); };
  $('#mic').onclick = async () => {
    const mic = $('#mic'); if (mic.classList.contains('rec')) { Recog.stopEarly(); return; }
    TTS.stop(); mic.classList.add('rec'); $('#fb').textContent = 'Listening…';
    let rec;
    try { rec = await Recog.record({ maxMs: 5000, silenceMs: 900, onLevel: v => { const l = $('#lvl'); if (l) l.style.width = Math.min(100, v * 400) + '%'; } }); }
    catch (e) { mic.classList.remove('rec'); $('#fb').textContent = 'I can’t use the microphone. Ask a grown-up to allow it.'; return; }
    if (!g.alive) return;
    mic.classList.remove('rec'); $('#fb').textContent = 'Thinking…';
    let res = null;
    try { res = rec.speech ? await Recog.transcribe(rec) : null; } catch (e) { console.warn(e); }
    if (!g.alive) return;
    const v = judgeWord(target.word, res);
    if (v.verdict === 'right') {
      chime('good'); const r = mic.getBoundingClientRect(); confetti(r.left + r.width / 2, r.top);
      if (!g.tries) addStar();
      recordAnswer(target.word, 'say-right', { game: 'say', heard: v.heard, p: v.p });
      $('#fb').textContent = praise(); await TTS.say($('#fb').textContent);
      g.i++; g.tries = 0; await sleep(300); sayRound();
    } else if (v.verdict === 'unclear') {
      recordAnswer(target.word, 'say-unclear', { game: 'say', heard: v.heard });
      $('#fb').textContent = 'I didn’t quite catch that. Try again?';
      await TTS.say('I didn’t quite catch that. Try again?');
    } else {
      g.tries++;
      if (g.tries === 1) recordAnswer(target.word, 'say-wrong', { game: 'say', heard: v.heard, p: v.p });
      $('#fb').textContent = 'Let’s hear it together…';
      await TTS.say('Listen.'); await TTS.say(target.display, { word: true });
      if (g.tries >= 2) { $('#fb').textContent = 'Good try! Let’s do the next one.'; await TTS.say('Good try!'); g.i++; g.tries = 0; await sleep(400); sayRound(); }
      else $('#fb').textContent = 'Now you try!';
    }
  };
}

$('#gameQuit').onclick = () => { if (GAME) GAME.alive = false; Recog.closeMic(); renderGames(); };
