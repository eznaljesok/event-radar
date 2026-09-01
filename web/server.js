// Event Radar — live viewer (local). Renders data/scored/events.json on each request.
// Shares the HTML/CSS template with pipeline/build-site.js via web/template.js.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { renderPage } = require('./template');

const ROOT = path.join(__dirname, '..');
const PORT = process.env.PORT || 4173;
const HOST = '127.0.0.1';

const readJSON = p => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));

function render() {
  let refreshed = null;
  try { refreshed = fs.statSync(path.join(ROOT, 'data/scored/events.json')).mtime; } catch {}
  return renderPage({
    cfg: readJSON('config.json'),
    events: readJSON('data/scored/events.json'),
    refreshed,
  });
}

const FILES = {
  '/events.ics': ['out/events.ics', 'text/calendar; charset=utf-8'],
  '/digest.md': ['out/digest.md', 'text/plain; charset=utf-8'],
  '/events.json': ['data/scored/events.json', 'application/json; charset=utf-8'],
};

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  try {
    if (url === '/' || url === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end(render());
    }
    if (FILES[url]) {
      const [p, type] = FILES[url];
      res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
      return res.end(fs.readFileSync(path.join(ROOT, p)));
    }
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404');
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('500: ' + err.message);
  }
});

server.listen(PORT, HOST, () => console.log(`Event Radar viewer -> http://${HOST}:${PORT}`));
