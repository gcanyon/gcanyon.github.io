// ===========================================================================
// Startup
// ===========================================================================
document.addEventListener('click', e => {
  const a = e.target.closest('[data-act]'); if (!a) return;
  audioCtx();
  const act = a.dataset.act;
  if (act === 'readers') renderReaders();
  else if (act === 'library') renderLibrary();
  else if (act === 'games') renderGames();
  else if (act === 'parent') parentGate(() => openParent());
  else if (act === 'add-story') parentGate(() => openParent('stories'));
});

(async function init() {
  try { await DB.open(); }
  catch (e) { document.body.innerHTML = `<p style="padding:24px;font-family:sans-serif">This browser is blocking storage (private mode?), so Tap &amp; Read can’t save progress. Please open it in a normal window.</p>`; return; }
  await loadSettings();
  SystemVoice.init();
  navigator.storage?.persist?.().catch(() => {});
  wireBook();
  if (S.engine === 'kokoro' && S.kokoroWanted) Kokoro.load().catch(e => console.warn('Kokoro unavailable', e));
  if (S.recog) Recog.load().then(() => { if (document.body.dataset.screen === 'book') $('#readAloudBtn').classList.remove('hidden'); }).catch(e => console.warn('Whistle unavailable', e));
  const readers = await DB.all('readers');
  const lastId = await KV.get('lastReader');
  const last = readers.find(r => r.id === lastId);
  if (readers.length === 1 && last) { READER = last; renderLibrary(); }
  else renderReaders();
})();

// Handy for debugging from the console.
window.tapread = { DB, get S() { return S; }, TTS, Kokoro, Recog, alignReading, scoreReading, judgeWord, paginate, parseScript, importFile, practiceWords };
