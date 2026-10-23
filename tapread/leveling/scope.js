// Tap & Read reading levels: the phonics scope.
// Levels are guidance, not gates. Any word can be tapped, so a story may use a few
// out-of-level words: each level allows a budget of new "tricky" words per page
// (a repeated word only counts the first time it appears).
// Internal bands are 0–7; readers and parents see them as Level 1–8.
// A word is "decodable" at a band if its dictionary pronunciation (CMU) can be built
// from the letter–sound patterns taught up to that band. Sight words count as known
// from the band where they are taught, even when they aren't decodable yet.

const LEVELS = [
  { band: 0, level: 1, color: 'red',    note: 'First sounds: m, s, t, p, n, c and short a, plus a few sight words. Pattern books with one repeated sentence.',
    limits: { wordsPerPage: 10,  wordsPerSentence: 8 },  floor: 0.80, newTrickyPerPage: 1 },
  { band: 1, level: 2, color: 'orange', note: 'Short a and i with most single consonants, and -s endings (cat, sit, pigs, digs).',
    limits: { wordsPerPage: 18,  wordsPerSentence: 7 },  floor: 0.80, newTrickyPerPage: 1.5 },
  { band: 2, level: 3, color: 'yellow', note: 'All short vowels and consonants, plus ff, ll, ss, zz (hot, bug, bed, hill, quiz).',
    limits: { wordsPerPage: 25,  wordsPerSentence: 8 },  floor: 0.80, newTrickyPerPage: 2 },
  { band: 3, level: 4, color: 'green',  note: 'Digraphs and blends: sh, ch, th, wh, ck, ng, nk; st-, fl-, -nd, -mp (ship, frog, jump, sing).',
    limits: { wordsPerPage: 35,  wordsPerSentence: 9 },  floor: 0.80, newTrickyPerPage: 2.5 },
  { band: 4, level: 5, color: 'teal',   note: 'Long vowels: silent e (cake), ee, ea, ai, ay, oa, ow, igh, y; endings -ed, -ing, -er.',
    limits: { wordsPerPage: 55,  wordsPerSentence: 11 }, floor: 0.80, newTrickyPerPage: 3 },
  { band: 5, level: 6, color: 'blue',   note: 'Vowel sounds: ar, or, er, ir, ur; oi, oy, ou, ow; oo; aw, au; soft c and g; -le; two-syllable words.',
    limits: { wordsPerPage: 85,  wordsPerSentence: 13 }, floor: 0.80, newTrickyPerPage: 4 },
  { band: 6, level: 7, color: 'indigo', note: 'Big words: prefixes and suffixes (un-, re-, -ful, -less, -ly, -tion), kn, wr, ph.',
    limits: { wordsPerPage: 160, wordsPerSentence: 17 }, floor: 0.75, newTrickyPerPage: 6 },
  { band: 7, level: 8, color: 'violet', note: 'Chapter books: no limits.',
    limits: { wordsPerPage: Infinity, wordsPerSentence: Infinity }, floor: 0, newTrickyPerPage: Infinity },
];

// Letter–sound correspondences: [spelling, sounds (CMU phonemes, no stress), band introduced].
// A spelling can appear more than once with different sounds introduced at different bands.
const GRAPHEMES = [
  // band 0
  ['a', 'AE', 0], ['m', 'M', 0], ['s', 'S', 0], ['t', 'T', 0], ['p', 'P', 0], ['n', 'N', 0], ['c', 'K', 0],
  // band 1
  ['i', 'IH', 1], ['f', 'F', 1], ['b', 'B', 1], ['g', 'G', 1], ['d', 'D', 1], ['h', 'HH', 1], ['l', 'L', 1], ['r', 'R', 1], ['s', 'Z', 1],
  // band 2
  ['o', 'AA', 2], ['o', 'AO', 2], ['u', 'AH', 2], ['e', 'EH', 2],
  ['j', 'JH', 2], ['k', 'K', 2], ['v', 'V', 2], ['w', 'W', 2], ['x', 'K S', 2], ['y', 'Y', 2], ['z', 'Z', 2], ['qu', 'K W', 2],
  ['ff', 'F', 2], ['ll', 'L', 2], ['ss', 'S', 2], ['zz', 'Z', 2],
  // band 3
  ['sh', 'SH', 3], ['ch', 'CH', 3], ['th', 'TH', 3], ['th', 'DH', 3], ['wh', 'W', 3], ['ck', 'K', 3], ['ng', 'NG', 3], ['nk', 'NG K', 3],
  ['es', 'IH Z', 3], ['es', 'AH Z', 3],   // plural -es (boxes, wishes)
  // band 4 (silent-e long vowels are handled as a pattern, see VCE below)
  ['ee', 'IY', 4], ['ea', 'IY', 4], ['ai', 'EY', 4], ['ay', 'EY', 4], ['oa', 'OW', 4], ['ow', 'OW', 4], ['igh', 'AY', 4],
  ['y', 'IY', 4], ['y', 'AY', 4], ['ed', 'T', 4], ['ed', 'D', 4], ['ed', 'IH D', 4], ['ed', 'AH D', 4], ['er', 'ER', 4],
  ['bb', 'B', 4], ['dd', 'D', 4], ['gg', 'G', 4], ['mm', 'M', 4], ['nn', 'N', 4], ['pp', 'P', 4], ['rr', 'R', 4], ['tt', 'T', 4],
  // band 5
  ['ar', 'AA R', 5], ['or', 'AO R', 5], ['ore', 'AO R', 5], ['ir', 'ER', 5], ['ur', 'ER', 5],
  ['oi', 'OY', 5], ['oy', 'OY', 5], ['ou', 'AW', 5], ['ow', 'AW', 5], ['oo', 'UW', 5], ['oo', 'UH', 5],
  ['aw', 'AO', 5], ['au', 'AO', 5], ['al', 'AO L', 5], ['c', 'S', 5], ['g', 'JH', 5], ['ge', 'JH', 5], ['ce', 'S', 5],
  ['le', 'AH L', 5], ['all', 'AO L', 5], ['ng', 'NG G', 5], ['tch', 'CH', 5], ['dge', 'JH', 5], ['u', 'UH', 5],
  ['a', 'EY', 5], ['e', 'IY', 5], ['i', 'AY', 5], ['o', 'OW', 5], ['u', 'UW', 5], ['u', 'Y UW', 5],   // open syllables (pa-per, ro-bot)
  // band 6
  ['kn', 'N', 6], ['wr', 'R', 6], ['ph', 'F', 6], ['gn', 'N', 6], ['mb', 'M', 6], ['tion', 'SH AH N', 6], ['sion', 'ZH AH N', 6],
  ['ea', 'EH', 6], ['ie', 'IY', 6], ['ie', 'AY', 6], ['ey', 'IY', 6], ['ew', 'UW', 6], ['ue', 'UW', 6], ['air', 'EH R', 6],
  ['a', 'AA', 6], ['a', 'AO', 6], ['wh', 'HH', 6], ['or', 'ER', 6], ['alk', 'AO K', 6],
  ['ear', 'IH R', 6], ['eer', 'IH R', 6], ['are', 'EH R', 6], ['ful', 'F AH L', 6], ['ly', 'L IY', 6],
];
// Silent e: vowel + one consonant + e makes the vowel long (cake, bike, home, cute, these). Band 4.
const VCE = { band: 4, long: { a: ['EY'], e: ['IY'], i: ['AY'], o: ['OW'], u: ['UW', 'Y UW'] } };
// From band 5, a final e can be silent after any vowel sound (house, cheese, give).
const SILENT_FINAL_E_BAND = 5;
// Compound words (sun+set, light+house) are taught in band 4.
const COMPOUND_BAND = 4;
// From band 5, an unstressed vowel letter may be pronounced as a schwa (a-bout, wag-on).
const SCHWA_BAND = 5;

// Sight words (Dolch lists, public domain), by the band where they're taught.
const DOLCH = {
  prePrimer: 'a and away big blue can come down find for funny go help here I in is it jump little look make me my not one play red run said see the three to two up we where yellow you',
  primer: 'all am are at ate be black brown but came did do eat four get good have he into like must new no now on our out please pretty ran ride saw say she so soon that there they this too under want was well went what white who will with yes',
  first: 'after again an any as ask by could every fly from give going had has her him his how just know let live may of old once open over put round some stop take thank them then think walk were when',
  second: "always around because been before best both buy call cold does don't fast first five found gave goes green its made many off or pull read right sing sit sleep tell their these those upon us use very wash which why wish work would write your",
  third: 'about better bring carry clean cut done draw drink eight fall far full got grow hold hot hurt if keep kind laugh light long much myself never only own pick seven shall show six small start ten today together try warm',
};
const words = s => s.toLowerCase().split(/\s+/);
const BAND0_SIGHT = words('a and big can go here I in is it look me my red said see the to up we');
const BAND2_SIGHT = words('am at be but did do get he no on she so that this was yes are have all they with what who came eat');
const SIGHT = {};
const teach = (list, band) => { for (const w of list) if (!(w in SIGHT)) SIGHT[w] = band; };
teach(BAND0_SIGHT, 0);
teach(words(DOLCH.prePrimer), 1);
teach(BAND2_SIGHT, 2);
teach(words(DOLCH.primer), 3);
teach(words(DOLCH.first), 4);
teach(words(DOLCH.second), 5);
teach(words(DOLCH.third), 6);

if (typeof module !== 'undefined') module.exports = { LEVELS, GRAPHEMES, VCE, SCHWA_BAND, SILENT_FINAL_E_BAND, COMPOUND_BAND, SIGHT, DOLCH };
