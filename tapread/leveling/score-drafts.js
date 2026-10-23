// Score story drafts: stories separated by "===", pages by "---";
// "# Title", "@target N", "@names A, B", "@pic …" lines.
const fs = require('fs');
const scope = require('./scope.js');
const { makeLeveler, parseCMU } = require('./leveling.js');
const L = makeLeveler(scope, parseCMU(fs.readFileSync(__dirname + '/deps/cmudict/data/cmudict.dict', 'utf8')));
for (const chunk of fs.readFileSync(process.argv[2], 'utf8').split(/^===\s*$/m)) {
  const title = (chunk.match(/^# (.+)$/m) || [])[1]; if (!title) continue;
  const target = +((chunk.match(/^@target (\d+)/m) || [])[1] || 0);
  const names = ((chunk.match(/^@names (.+)$/m) || [])[1] || '').split(',').map(s => s.trim()).filter(Boolean);
  const pages = chunk.split(/^---\s*$/m).map(p => p.split('\n').filter(l => l.trim() && !/^[#@]/.test(l.trim())).join('\n')).filter(Boolean);
  pages[0] = title + '.\n' + pages[0];
  const r = L.scoreStory(pages, { names });
  const t = r.byBand[target - 1];
  console.log(`\n${title}: target Level ${target} → scored Level ${r.level} ${r.level === target ? '✓' : '✗'}  (${pages.length} pages, ${r.words} words)`);
  if (t) console.log(`  at Level ${target}: ${Math.round(t.decodable * 100)}% known, ${t.trickyPerPage} new tricky words/page${t.fitsText ? '' : ', text too long'}`);
  console.log(`  tap words: ${r.tricky.join(', ') || '—'}`);
  if (r.level !== target) console.log(`  kept out of Level ${r.level - 1}: ${r.blockers.join(', ')}`);
}
