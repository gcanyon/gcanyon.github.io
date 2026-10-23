# Leveling tools

The app levels books with `vendor/levels/wordlevels.json`: the reading level (1–8) of every
word in the CMU Pronouncing Dictionary. These scripts build that file and score story drafts.

- `scope.js`: the phonics scope. Letter–sound patterns and Dolch sight words by level, plus each
  level's page/sentence limits, known-word floor and tricky-words-per-page budget.
- `leveling.js`: decides a word's level. A word is decodable at a level when its dictionary
  pronunciation can be built from the patterns taught up to that level.
- `build-wordlevels.js`: regenerates `../vendor/levels/wordlevels.json` after editing the scope.
- `score-drafts.js`: scores draft stories (`# Title`, `@target N`, `@names A, B`, `---` page breaks, `===` between stories).

The scripts need the CMU dictionary at `deps/cmudict/data/cmudict.dict`:

    pip download cmudict --no-deps -d /tmp/cmud && mkdir -p deps && unzip -o /tmp/cmud/cmudict-*.whl -d deps

Then:

    node build-wordlevels.js ../vendor/levels/wordlevels.json
    node score-drafts.js drafts.txt

The level limits in `scope.js` must match `LEVELS` in `index.html`.
