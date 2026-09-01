// compiler stage — rank scored events, render out/digest.md + out/events.ics
// Reads:  data/scored/events.json, config.json
// Writes: out/digest.md, out/events.ics
const fs = require('fs');
const path = require('path');
const { ROOT, resolveWindow, readJSON } = require('./lib');

const cfg = readJSON('config.json');
const RAZVRSTI = cfg.razvrsti_po === 'datum' ? 'datum' : 'odmevnost';
const events = readJSON('data/scored/events.json');
if (!Array.isArray(events) || events.length === 0) {
  console.error('[compiler] data/scored/events.json je prazen — out/ NE prepišem.');
  process.exit(2);
}
const win = resolveWindow(cfg);
const OD = events.reduce((a, e) => e.datum < a ? e.datum : a, win.od);
const DO = events.reduce((a, e) => e.datum > a ? e.datum : a, win.do);
const KRAJ = cfg.kraj;
const CAT_LABEL = { glasba: 'Glasba', kultura: 'Kultura', sport: 'Šport' };
const CAT_ORDER = ['glasba', 'kultura', 'sport'];

const byScore = (a, b) => b.odmevnost.skupaj - a.odmevnost.skupaj || a.datum.localeCompare(b.datum) || a.naslov.localeCompare(b.naslov);
const byDate = (a, b) => a.datum.localeCompare(b.datum) || (a.ura || '99:99').localeCompare(b.ura || '99:99') || a.naslov.localeCompare(b.naslov);
const cmp = RAZVRSTI === 'odmevnost' ? byScore : byDate;
const top5 = events.slice().sort(byScore).slice(0, 5);

// ---------- digest.md ----------
const fmtLine = e => {
  const ura = e.ura ? ` ${e.ura}` : '';
  const zn = (e.znacke && e.znacke.length) ? `\n  \`${e.znacke.join('` · `')}\`` : '';
  const vir = (e.viri && e.viri[0]) ? `\n  <${e.viri[0]}>` : '';
  return `- **${e.naslov}** — ${e.datum}${ura}, ${e.prizorisce} (${e.kraj}) · odmevnost ${e.odmevnost.skupaj}/100\n  ${e.opis}${zn}${vir}`;
};
let md = `# Event Radar — pregled dogodkov\n\n`;
md += `**Obseg:** ${KRAJ} in okolica (${(cfg.vkljuci_naselja || []).join(', ')}) · ${OD} – ${DO} · **${events.length} dogodkov** · razvrščeno po: ${RAZVRSTI}\n\n`;
md += `## TOP 5 po odmevnosti\n\n`;
top5.forEach((e, i) => {
  const ura = e.ura ? ` ${e.ura}` : '';
  md += `${i + 1}. **${e.naslov}** — ${e.datum}${ura}, ${e.prizorisce} · ${e.odmevnost.skupaj}/100 _(${e.kategorija})_\n`;
});
md += `\n`;
for (const cat of CAT_ORDER) {
  const rows = events.filter(e => e.kategorija === cat).sort(cmp);
  if (!rows.length) continue;
  md += `## ${CAT_LABEL[cat]} (${rows.length})\n\n` + rows.map(fmtLine).join('\n\n') + '\n\n';
}
md += `---\n_Ocene odmevnosti so relativna razvrstitev znotraj tega nabora, ne absolutna resnica._\n`;
fs.writeFileSync(path.join(ROOT, 'out/digest.md'), md, 'utf8');

// ---------- events.ics ----------
const esc = s => String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const fold = line => {
  if (Buffer.from(line, 'utf8').length <= 73) return line;
  const out = []; let cur = '';
  for (const ch of line) {
    if (Buffer.from(cur + ch, 'utf8').length > 73) { out.push(cur); cur = ' ' + ch; }
    else cur += ch;
  }
  if (cur) out.push(cur);
  return out.join('\r\n');
};
const dtStamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Event Radar//SI events//SL', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Event Radar — ' + KRAJ];
for (const e of events.slice().sort((a, b) => a.datum.localeCompare(b.datum) || (a.ura || '').localeCompare(b.ura || ''))) {
  const d = e.datum.replace(/-/g, '');
  L.push('BEGIN:VEVENT', 'UID:' + e.id + '@event-radar', 'DTSTAMP:' + dtStamp);
  if (e.ura && /^\d{2}:\d{2}$/.test(e.ura)) {
    L.push('DTSTART:' + d + 'T' + e.ura.replace(':', '') + '00');
    const eh = +e.ura.slice(0, 2) + 2;
    const endDay = eh >= 24 ? String(+d + 1) : d;
    L.push('DTEND:' + endDay + 'T' + String(eh % 24).padStart(2, '0') + e.ura.slice(3) + '00');
  } else {
    L.push('DTSTART;VALUE=DATE:' + d);
    const nd = new Date(Date.UTC(+e.datum.slice(0, 4), +e.datum.slice(5, 7) - 1, +e.datum.slice(8, 10) + 1));
    L.push('DTEND;VALUE=DATE:' + nd.toISOString().slice(0, 10).replace(/-/g, ''));
  }
  L.push(fold('SUMMARY:' + esc(e.naslov)));
  L.push(fold('LOCATION:' + esc(e.prizorisce + ', ' + e.kraj)));
  const desc = (e.opis || '') + (e.znacke && e.znacke.length ? ' [' + e.znacke.join(', ') + ']' : '');
  if (desc.trim()) L.push(fold('DESCRIPTION:' + esc(desc)));
  if (e.viri && e.viri[0]) L.push(fold('URL:' + e.viri[0]));
  L.push('CATEGORIES:' + e.kategorija.toUpperCase(), 'END:VEVENT');
}
L.push('END:VCALENDAR');
fs.writeFileSync(path.join(ROOT, 'out/events.ics'), L.join('\r\n') + '\r\n', 'utf8');

console.log(JSON.stringify({
  razvrsti_po: RAZVRSTI, dogodkov: events.length,
  po_kategorijah: CAT_ORDER.reduce((o, c) => (o[c] = events.filter(e => e.kategorija === c).length, o), {}),
  top5: top5.map(e => `${e.odmevnost.skupaj}/100  ${e.naslov}`),
  vevent: L.filter(x => x === 'BEGIN:VEVENT').length,
  poti: ['out/digest.md', 'out/events.ics']
}, null, 2));
