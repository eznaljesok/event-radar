// Shared helpers for the Event Radar pipeline.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function pad(n) { return String(n).padStart(2, '0'); }
function isoDay(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

// Resolve config.okno -> { od, do } as ISO dates, using the machine's local "today".
function resolveWindow(cfg) {
  const dni = Number(cfg?.okno?.dni ?? 7);
  const from = cfg?.okno?.od ?? 'today';
  const start = from === 'today' || !/^\d{4}-\d{2}-\d{2}$/.test(from)
    ? new Date()
    : new Date(from + 'T12:00:00');
  start.setHours(12, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + dni);
  return { od: isoDay(start), do: isoDay(end), dni };
}

const readJSON = p => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const writeJSON = (p, v) => fs.writeFileSync(path.join(ROOT, p), JSON.stringify(v, null, 2) + '\n', 'utf8');

module.exports = { ROOT, isoDay, resolveWindow, readJSON, writeJSON };
