# Tap & Read

A tap-to-hear reader for kids. Every word, title and page number can be tapped to hear it; taps are logged per reader and weighted, and the word games practise exactly those words. A grown-ups area shows progress, manages stories, and holds the settings.

## Deploying to GitHub Pages

Copy this folder into a repo (or a subfolder of your Pages site) and push:

```
index.html                ← the whole app
vendor/cactus-needle/     ← only needed for speech recognition (Whistle)
```

That's it — no build step to deploy. Pages serves over HTTPS, which the microphone and the model integrity checks require.

To try it locally: `python3 -m http.server` in this folder, then open http://localhost:8000. (Opening `index.html` as a `file://` URL won't work: browsers block storage, workers and the microphone there.)

## What loads from where

| Piece | Source | Size | When |
| --- | --- | --- | --- |
| App | `index.html` | 125 KB | always |
| Fonts (Andika, Fredoka) | Google Fonts | small | always; falls back to system fonts offline |
| Device voice | the browser's Web Speech API | 0 | default |
| Kokoro voice | kokoro-js from jsDelivr, weights from Hugging Face | ~90 MB once | only if chosen in Settings → Voice |
| JSZip | cdnjs | 100 KB | only when importing an EPUB |
| Whistle speech recognition | `vendor/cactus-needle` + model from Hugging Face | 1 MB + 17 MB once | only if enabled in Settings |

Downloaded models are cached by the browser. Kokoro audio is also saved per word in IndexedDB, and words on the current and next page are generated in the background, so taps get instant after first use.

## Using it

- **Tap** a word to hear it. **Press and hold** to hear the whole sentence. 🔊 reads the page aloud, highlighting each sentence.
- **Add stories** (Grown-ups → Stories): `.txt`, `.html`, `.epub`, or paste text. Project Gutenberg EPUBs import cleanly (boilerplate is stripped). In text, `---` on its own line is a page break, `# Title`, `## Chapter`, and `@pic 🐸` for an emoji picture. Without page breaks, text is split into ~90-word pages (adjustable).
- **Pronunciation fixes** (Settings) override how a word is spoken, for names like Ozma.
- **Backup**: everything lives in this browser's storage. Settings → Backup saves/restores a JSON file.

## How words are weighted

Each tap is stored with a timestamp. A word's practice weight is its taps with a 14-day half-life, plus extra weight for game misses and read-aloud misses, minus a little for correct answers. Each word also sits in a Leitner box (0–5): a tap in a story resets it to 0, a first-try correct game answer moves it up a box (due again in 1, 2, 4, 8, 16 days), a miss drops it to 0. Box 5 is "mastered" and leaves the practice list. Games pick words that are due first, then by weight.

## Speech recognition (experimental)

Enable in Settings. Adds:

- **Say It!** game: the word appears, the child taps 🎤 and says it. Right → praise. A different word heard with confidence → the app says the word and offers one more try. Low confidence or nothing heard → "I didn't quite catch that" (never counted as wrong). No keyword biasing is used when judging, since it would make the recognizer hear the target word.
- **🎤 I'll read it** on book pages: records the child reading the page, aligns the transcript to the text, and logs skipped/substituted words and long pauses (more than 3× the reader's typical gap, or repeated false starts) to the grown-ups view. The child only ever gets stars and encouragement.
- **Speech lab** (Grown-ups): before trusting any of this, have your reader say ~30 words correctly and ~15 deliberately wrong. It reports how often correct readings get rejected and how often mispronunciations get accepted, with recordings you can replay and a CSV export.

Whistle was trained and benchmarked on adult speech, so the lab numbers for your child are the ones that matter.

## Editing

`index.html` is the source: edit it directly (there is no build step). `window.tapread` in the console exposes the database and a few internals for debugging.

Vendored `cactus-needle` 0.3.0 (Apache-2.0) runs Whistle in a WebAssembly worker. Kokoro-82M and kokoro-js are Apache-2.0.
