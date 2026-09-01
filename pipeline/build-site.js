// build-site — render the static public site into docs/ (for GitHub Pages).
// Reads: config.json, data/scored/events.json, out/events.ics, out/digest.md
// Writes: docs/index.html, docs/events.ics, docs/digest.md, docs/events.json, docs/.nojekyll
const fs = require('fs');
const path = require('path');
const { ROOT, readJSON } = require('./lib');
const { renderPage } = require('../web/template');

const events = readJSON('data/scored/events.json');
if (!Array.isArray(events) || events.length === 0) {
  console.error('[build-site] 0 dogodkov — docs/ NE prepišem.');
  process.exit(2);
}

let refreshed = null;
try { refreshed = fs.statSync(path.join(ROOT, 'data/scored/events.json')).mtime; } catch {}

const outDir = path.join(ROOT, 'docs');
fs.mkdirSync(outDir, { recursive: true });

fs.writeFileSync(path.join(outDir, 'index.html'),
  renderPage({ cfg: readJSON('config.json'), events, refreshed }), 'utf8');

for (const f of ['out/events.ics', 'out/digest.md', 'data/scored/events.json']) {
  const src = path.join(ROOT, f);
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(outDir, path.basename(f)));
}
fs.writeFileSync(path.join(outDir, '.nojekyll'), '', 'utf8');

console.log(`[build-site] docs/ zgrajen — ${events.length} dogodkov, osveženo ${refreshed ? refreshed.toISOString() : 'neznano'}`);
