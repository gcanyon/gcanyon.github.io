// Precompute the level of every dictionary word, for in-browser scoring of imported books.
// Output: { v, bands: [ "words at band 0", ..., "words at band 6" ] }; words not listed are band 7 (Level 8).
const fs = require('fs');
const scope = require('./scope.js');
const { makeLeveler, parseCMU } = require('./leveling.js');
const dict = parseCMU(fs.readFileSync(__dirname + '/deps/cmudict/data/cmudict.dict', 'utf8'));
const L = makeLeveler(scope, dict);
const bands = [[], [], [], [], [], [], []];
const words = new Set([...dict.keys(), ...Object.keys(scope.SIGHT)]);
let n = 0;
for (const w of words) {
  if (!/^[a-z]+('[a-z]+)?$/.test(w)) continue;
  const b = L.wordBand(w); if (b < 7) bands[b].push(w); n++;
}
const out = { v: 1, source: 'CMU Pronouncing Dictionary + Tap & Read phonics scope', bands: bands.map(b => b.sort().join(' ')) };
fs.writeFileSync(process.argv[2], JSON.stringify(out));
console.log('words checked', n, 'per band', bands.map(b => b.length).join(' '), 'bytes', fs.statSync(process.argv[2]).size);
