// curator stage — merge raw scout files, tightened dedup, filter by window + scope.
// Reads:  data/raw/{glasba,kultura,sport}.json, config.json
// Writes: data/clean/events.json
// Exits non-zero WITHOUT overwriting if there is no usable raw input.
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const { ROOT, resolveWindow, readJSON, writeJSON } = require('./lib');

const cfg = readJSON('config.json');
const KRAJ = cfg.kraj;
const NASELJA = cfg.vkljuci_naselja || [];
const { od: OD, do: DO } = resolveWindow(cfg);
const SCOPE = new Set([KRAJ, ...NASELJA].map(s => s.toLowerCase()));
const CAT_RANK = { glasba: 0, kultura: 1, sport: 2 };
const RAW = ['glasba', 'kultura', 'sport'];

const deacc = s => (s || '').toString().normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
const norm = s => deacc(s).replace(/[^a-z0-9]+/g, ' ').trim();
// znacilne besede prizorisca (>=4 crk) — za primerjavo, ki je odporna na "Dvorana, Hisa" vs "Hisa"
const venueToks = s => new Set(norm(s).split(' ').filter(t => t.length >= 4));
const venueCompatible = (a, b) => {
  const A = venueToks(a), B = venueToks(b);
  if (!A.size || !B.size) return true;
  for (const x of A) if (B.has(x)) return true;
  return false;
};

const TITLE_STOP = new Set(['i', 'in', 'and', 'the', 'of', 'a', 'an', 'na', 'po', 'z', 's', 'za', 'ob', 'v', 'je', 'se', 'ter', 'k',
  'ljubljana', 'ljubljanski', 'ljubljanskih', 'ljubljanska', 'festival', 'muzikal', 'razstava', 'pregledna', 'obcasna',
  'tradicionalna', 'prireditev', 'dan', 'kasneje', 'let', 'snl', 'krog', 'liga', 'telemach', 'prva', 'st', 'ni', 'de', 'du']);
const titleToks = s => new Set(norm(s).split(' ').filter(t => t && !TITLE_STOP.has(t)));
const tokMatch = (a, b) => {
  if (a === b) return true;
  const [x, y] = a.length <= b.length ? [a, b] : [b, a];
  return x.length >= 5 && y.startsWith(x);
};
const overlapCount = (A, B) => {
  let n = 0;
  for (const a of A) for (const b of B) if (tokMatch(a, b)) { n++; break; }
  return n;
};

// --- 1) merge -------------------------------------------------------------
let merged = [];
const rawByCat = {};
for (const k of RAW) {
  const p = path.join(ROOT, 'data/raw', k + '.json');
  if (!fs.existsSync(p)) { console.warn(`[curator] manjka ${k}.json`); continue; }
  let arr;
  try { arr = JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch (e) { console.warn(`[curator] ${k}.json ni veljaven JSON: ${e.message}`); continue; }
  if (!Array.isArray(arr)) continue;
  rawByCat[k] = arr.length;
  merged = merged.concat(arr);
}
const raw_skupaj = merged.length;
if (raw_skupaj === 0) {
  console.error('[curator] 0 raw zapisov — obstoječega data/clean/events.json NE prepišem.');
  process.exit(2);
}

// --- 2a) exact dedup ----------------------------------------------------
const exactMap = new Map();
for (const e of merged) {
  const key = norm(e.naslov) + '|' + e.datum + '|' + norm(e.prizorisce);
  if (exactMap.has(key)) {
    const ex = exactMap.get(key);
    ex.viri = [...new Set([...(ex.viri || []), ...(e.viri || [])])];
  } else {
    exactMap.set(key, { ...e, viri: [...new Set(e.viri || [])] });
  }
}
let recs = [...exactMap.values()];
const po_exact = recs.length;

// --- 2b) fuzzy dedup: grupiraj po DATUMU, znotraj dneva zdruzi zapise z
//         zdruzljivim prizoriscem IN dovolj prekrivajocim se naslovom --------
const groups = new Map();
for (const e of recs) {
  if (!groups.has(e.datum)) groups.set(e.datum, []);
  groups.get(e.datum).push(e);
}
const mergeLog = [];
const kept = [];
for (const [, arr] of groups) {
  const clusters = [];
  for (const e of arr) {
    const et = titleToks(e.naslov);
    let placed = false;
    for (const c of clusters) {
      if (!c.members.some(m => venueCompatible(m.prizorisce, e.prizorisce))) continue;
      const inter = overlapCount(et, c.toks);
      const uni = new Set([...et, ...c.toks]).size;
      const jac = uni ? inter / uni : 0;
      const subset = inter === Math.min(et.size, c.toks.size) && inter >= 1;
      if (inter >= 2 || jac >= 0.5 || (subset && Math.min(et.size, c.toks.size) >= 2)) {
        c.members.push(e);
        for (const t of et) c.toks.add(t);
        placed = true;
        break;
      }
    }
    if (!placed) clusters.push({ toks: new Set(et), members: [e] });
  }
  for (const c of clusters) {
    if (c.members.length === 1) { kept.push(c.members[0]); continue; }
    const primary = c.members.slice().sort((a, b) =>
      (CAT_RANK[a.kategorija] - CAT_RANK[b.kategorija]) ||
      (b.prizorisce.length - a.prizorisce.length) ||
      ((b.viri || []).length - (a.viri || []).length))[0];
    const rec = { ...primary, viri: [...new Set(c.members.flatMap(m => m.viri || []))] };
    if (!rec.ura) { const u = c.members.find(m => m.ura); if (u) rec.ura = u.ura; }
    mergeLog.push(`${primary.naslov}  <=  ` + c.members.filter(m => m !== primary).map(o => o.naslov).join(' | '));
    kept.push(rec);
  }
}
recs = kept;

// --- 3+4) filter + id -------------------------------------------------
const FIELD_ORDER = ['id', 'kategorija', 'naslov', 'datum', 'ura', 'prizorisce', 'kraj', 'viri'];
const clean = recs
  .filter(e => e.naslov && e.datum && /^\d{4}-\d{2}-\d{2}$/.test(e.datum)
    && e.datum >= OD && e.datum <= DO && SCOPE.has(norm(e.kraj)))
  .map(e => {
    e.id = crypto.createHash('sha1').update(`${e.naslov}|${e.datum}|${e.prizorisce}`).digest('hex');
    const o = {};
    for (const k of FIELD_ORDER) o[k] = k in e ? e[k] : (k === 'ura' ? null : undefined);
    if (o.ura === undefined) o.ura = null;
    return o;
  })
  .sort((a, b) => a.datum.localeCompare(b.datum) || CAT_RANK[a.kategorija] - CAT_RANK[b.kategorija] || a.naslov.localeCompare(b.naslov));

writeJSON('data/clean/events.json', clean);

const cleanByCat = {};
for (const e of clean) cleanByCat[e.kategorija] = (cleanByCat[e.kategorija] || 0) + 1;
console.log(JSON.stringify({
  okno: { od: OD, do: DO },
  raw_skupaj, raw_po_kategorijah: rawByCat,
  po_exact_dedup: po_exact,
  spojeno_fuzzy: po_exact - recs.length,
  po_dedup: recs.length,
  odvrzeno_filter: recs.length - clean.length,
  po_filtru: clean.length,
  clean_po_kategorijah: cleanByCat,
  spojitve: mergeLog,
  pot: 'data/clean/events.json'
}, null, 2));
