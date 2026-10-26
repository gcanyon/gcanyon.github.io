# Tap & Read: working notes

Notes for picking up development. User-facing docs are in README.md.

## Goals
- A real early-reading resource. American English only, and the app doesn't call that out.
- A calling card for 0-1 AI/technical PM work, aimed at the founder of Bloomy Learning. It's not a product or acquisition pitch.
- Ship with 5–10 stories per level. Chapter books are the exception, since personal preference matters more there.

## Workflow
- `index.html` is the whole app (~288 KB). Edit it directly; there's no build step.
- Claude writes files into this repo through the desktop link. Geoff runs git himself: `git add`, `git commit`, `git push`.
- Testing: Playwright (headless Chromium) on a local copy, plus real-device checks in the desktop app's browser pane.
- Live at geoffcanyon.com/tapread.

## Architecture
- **Storage:** IndexedDB stores `kv`, `readers`, `stories`, `events` (indexed by reader), `words` (indexed by reader), `audio`.
- **Voices:**
  - Web Speech API by default.
  - Kokoro-82M via kokoro-js 1.2.1 in a module worker. WebGPU must run in **fp32**; fp16 gave garbled audio. The CPU fallback is q8.
  - PocketTTS in a classic worker, with parent voice cloning. Model files are cached in Cache Storage (`tapread-pocket-v1`) because Hugging Face's signed redirects defeat the HTTP cache.
- **Playback:** one HTMLAudioElement playing WAV blobs, with an unlock step and a fallback to the device voice. This is needed because Safari gesture rules and the iOS silent switch blocked Web Audio. A **150 ms lead-in** (`LEAD`) is added to every clip so word starts don't get cut off.
- **Whistle speech recognition:** vendored cactus-needle 0.3.0.
  - Runs a pitch-shift ensemble at [1, 0.9, 0.8, 0.72] with a "close" verdict.
  - Read-aloud takes the union across the ensemble runs.
  - The Speech lab has a "Compare methods" tool.
  - Safari needs the `play-and-record` audio session while recording.
- **Page turns:** StPageFlip 2.0.7, vendored. Workarounds:
  - Portrait mode is forced with `minWidth = ceil(w/2)+1`.
  - A MutationObserver adds `sp-back` to clone pages so the backs of turning pages are blank.
  - `flipBack()` works around flipPrev doing nothing in portrait mode.
  - Taps are delegated from `#board`.
  - `.page-inner` is a flex column so page numbers sit at the bottom.
- **Level 8 layout:** books are laid out with a hidden measuring element (`flowPages`) and split at word boundaries. Progress is stored as a word offset.
- **UI:** skeuomorphic: a bookcase, cloth books, bookends per level, an open hardcover on a table. The headphones icon is `HP_ICON` / `.hp-btn`.

## Levels
- **Shown as Level 1–8** with colors and no grade or age. The internal band is the level minus 1.
  - Defined in `leveling/scope.js` and in `LEVELS` in index.html. Keep the two in sync.
- **Word levels:** each word is checked for decodability against the CMU dictionary using the phonics scope, plus Dolch sight words by band. The results are precomputed in `vendor/levels/wordlevels.json` (built by `leveling/build-wordlevels.js`).
- **Story score:** the lowest level that passes all four tests:
  - known-word floor (80%; 75% at Level 7)
  - new tricky words per page (1, 1.5, 2, 2.5, 3, 4, 6)
  - words per page at the 90th percentile (10, 18, 25, 35, 55, 85, 160)
  - words per sentence at the 90th percentile (8, 7, 8, 9, 11, 13, 17)
- **Reader level:** the share of words read without a tap over the last 60 days, ignoring pages that were read aloud to the child.
  - Comfortable: the highest level read at ≥95%.
  - Drops one level after two readings below 88%.
  - Next step: comfortable + 1.
- **Story format:** `# Title`, `@names`, `@author`, `@pic`, with `---` page breaks.
  - `@level` makes the level **manual** and skips scoring.
  - Paste several stories separated by `=== next story ===`.
  - Stories export in the same format.
- **Scoring drafts:** `node leveling/score-drafts.js drafts.txt`. It uses `@target N` and needs the CMU dictionary at `leveling/deps/cmudict/data/cmudict.dict`.

## Open threads (as of Oct 26, 2026)
1. **Story library:** the target is 5–10 per level. There are 7 built-ins now.
   - Someone wrote an alternative "Bug Gets on the Bus." It scores Level 5, not 3. The Level 3 requirements and critique are in a Claude doc: https://claude.ai/artifact/ER5CPcCCTP3QCjryG9kYnB
   - Option: keep it as a Level 5 book and have a Level 3 version of the same story written.
2. **Focus labels for parents:** built Oct 26. `focus` is in `LEVELS` (index.html and scope.js), and `levelLabel(n)` returns "Level 3 · All short vowels". It's used on the Progress pill, the next-level line, the Starting level dropdown and the Library level dropdowns. Kids' screens (bookends, book labels) still show only the number. The `about` copy says "Focuses on…", not "teaches".
   - The `levelNotes` headline uses `levelPhrase(n)`, "Level 4 (blends and digraphs)". The per-book notes still use bare numbers.
5. **Library shelves:** a "📖 Recent books" shelf sits above "Picked for you". It holds every book in progress (latest first), then the last three finished. It replaced the "Keep reading" button. Picked for you now shows only books not started yet.
3. **Chapter books:** present Level 8 as "Chapter books," not as another rung on the ladder.
   - Plan: a bundled shelf of 10–20 public-domain American books, cleaned up and checked by hand (Baum's Oz, Thornton Burgess, Uncle Wiggily).
   - Plus a search-and-import in the parent area. To check: whether Gutendex allows browser fetches.
   - EPUB/TXT import already exists and strips Gutenberg boilerplate. Imports should be scored, not assumed to be Level 8.
   - Still needed: a table of contents and "continue from chapter X."
4. Skipped from the last round: item 11, at Geoff's request.
