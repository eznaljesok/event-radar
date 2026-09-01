// Event Radar — shared HTML/CSS template (Hyperstudio style).
// Used by web/server.js (live) and pipeline/build-site.js (static -> docs/).
// Links are RELATIVE so the page works both at "/" and under "/<repo>/" on GitHub Pages.

const MESECI = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'avg', 'sep', 'okt', 'nov', 'dec'];

const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const fmtDate = iso => {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d}. ${MESECI[m - 1]} ${y}`;
};
const dan = iso => ['NED', 'PON', 'TOR', 'SRE', 'ČET', 'PET', 'SOB'][new Date(iso + 'T12:00:00Z').getUTCDay()];
const fmtStamp = d => d
  ? `${d.getDate()}. ${MESECI[d.getMonth()]} ${d.getFullYear()} ob ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  : 'neznano';

const CAT = {
  glasba: { label: 'Glasba', icon: 'M4 12h3l2-7 4 14 2-7h5' },
  kultura: { label: 'Kultura', icon: 'M4 5c3-1 6-1 8 1 2-2 5-2 8-1v13c-3-1-6-1-8 1-2-2-5-2-8-1z M12 6v13' },
  sport: { label: 'Šport', icon: 'M5 4v16 M5 4l12 3-12 3' },
};
const CAT_ORDER = ['glasba', 'kultura', 'sport'];

// renderPage({ cfg, events, refreshed:Date|null, now:Date? }) -> full HTML string
function renderPage({ cfg, events, refreshed = null, now = new Date() }) {
  const RAZ = cfg.razvrsti_po === 'datum' ? 'datum' : 'odmevnost';
  const TODAY = now.toISOString().slice(0, 10);
  const OD = events.reduce((a, e) => e.datum < a ? e.datum : a, '9999');
  const DO = events.reduce((a, e) => e.datum > a ? e.datum : a, '0000');

  const byScore = (a, b) => b.odmevnost.skupaj - a.odmevnost.skupaj || a.datum.localeCompare(b.datum) || a.naslov.localeCompare(b.naslov);
  const byDate = (a, b) => a.datum.localeCompare(b.datum) || (a.ura || '99:99').localeCompare(b.ura || '99:99') || a.naslov.localeCompare(b.naslov);
  const sortFn = RAZ === 'odmevnost' ? byScore : byDate;
  const top5 = events.slice().sort(byScore).slice(0, 5);

  const eventRow = e => {
    const isToday = e.datum === TODAY;
    const ura = e.ura ? `<span class="dot">·</span><span>${esc(e.ura)}</span>` : '';
    const tags = (e.znacke || []).map(z => `<span class="tag">${esc(z)}</span>`).join('');
    const src = (e.viri && e.viri[0])
      ? `<a class="src" href="${esc(e.viri[0])}" target="_blank" rel="noopener">vir&nbsp;&#8599;</a>` : '';
    return `
      <article class="ev">
        <div class="ev__bar">
          <div class="ev__main">
            <h3 class="ev__title">${esc(e.naslov)}</h3>
            <div class="ev__meta">
              ${isToday ? '<span class="live"><i></i>DANES</span>' : `<span>${dan(e.datum)}</span>`}
              <span>${fmtDate(e.datum)}</span>${ura}
              <span class="dot">·</span><span>${esc(e.prizorisce)}</span>
              <span class="dot">·</span><span class="muted">${esc(e.kraj)}</span>
            </div>
          </div>
          <div class="ev__score">
            <span class="ev__score-n">${e.odmevnost.skupaj}</span><span class="ev__score-d">/100</span>
          </div>
        </div>
        <div class="meter" aria-hidden="true"><i style="width:${e.odmevnost.skupaj}%"></i></div>
        <p class="ev__desc">${esc(e.opis || '')}</p>
        <div class="ev__foot">
          <div class="tags">${tags}</div>
          ${src}
        </div>
      </article>`;
  };

  const sections = CAT_ORDER.map(cat => {
    const rows = events.filter(e => e.kategorija === cat).sort(sortFn);
    if (!rows.length) return '';
    const c = CAT[cat];
    return `
      <section class="sect" id="${cat}">
        <div class="sect__head">
          <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="${c.icon}"/></svg>
          <h2 class="sect__title">${c.label}</h2>
          <span class="sect__count">${rows.length} dogodkov</span>
        </div>
        <div class="ev-list">${rows.map(eventRow).join('')}</div>
      </section>`;
  }).join('');

  const topList = top5.map((e, i) => `
    <li class="top">
      <span class="top__num">${String(i + 1).padStart(2, '0')}</span>
      <span class="top__title">${esc(e.naslov)}</span>
      <span class="top__cat">${esc(e.kategorija)}</span>
      <span class="top__score">${e.odmevnost.skupaj}<span>/100</span></span>
    </li>`).join('');

  const naselja = (cfg.vkljuci_naselja || []).join(', ');
  const stamp = esc(fmtStamp(refreshed));

  return `<!doctype html>
<html lang="sl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Event Radar — ${esc(cfg.kraj)}</title>
<meta name="description" content="Pregled kulturnih, glasbenih in športnih dogodkov za ${esc(cfg.kraj)} in okolico, razvrščen po odmevnosti. Osveženo ${stamp}.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=IBM+Plex+Mono:wght@400&display=swap" rel="stylesheet">
<style>
  :root{
    --obsidian:#101010; --carbon:#080808; --chalk:#f3f3f3; --smoke:#9c9c9c;
    --ash:#c1c1c1; --graphite:#212121; --iron:#474747; --white:#fff;
    --gold:#6f6759; --pulse:#98ff38; --slate:#3b3d45;
    --f-sans:'Inter',ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
    --f-mono:'IBM Plex Mono',ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
    --maxw:1200px;
  }
  *{box-sizing:border-box;margin:0;padding:0}
  html{-webkit-text-size-adjust:100%}
  body{
    background:var(--obsidian); color:var(--chalk);
    font-family:var(--f-sans); font-weight:400; font-size:16px; line-height:1.25;
    -webkit-font-smoothing:antialiased; text-rendering:optimizeLegibility;
  }
  a{color:inherit;text-decoration:none}
  ::selection{background:var(--chalk);color:var(--obsidian)}

  .wrap{max-width:var(--maxw);margin:0 auto;padding:0 24px}

  .nav{position:sticky;top:0;z-index:10;background:var(--obsidian);border-bottom:1px solid var(--graphite)}
  .nav__in{max-width:var(--maxw);margin:0 auto;padding:18px 24px;display:flex;align-items:center;gap:32px}
  .brand{font-size:18px;letter-spacing:-.01em}
  .brand b{font-weight:400}
  .nav__links{display:flex;gap:24px;margin-left:8px}
  .nav__links a{font-family:var(--f-mono);font-size:13px;text-transform:uppercase;letter-spacing:-.02em;color:var(--smoke)}
  .nav__links a:hover{color:var(--chalk)}
  .nav__cta{margin-left:auto}
  .pill{display:inline-flex;align-items:center;gap:8px;background:var(--white);color:var(--obsidian);
    border-radius:9999px;padding:12px 22px;font-size:14px;text-transform:uppercase;letter-spacing:.02em;border:1px solid var(--white)}
  .pill:hover{background:transparent;color:var(--chalk)}

  .hero{padding:100px 0 80px;position:relative;overflow:hidden}
  .hero__dots{position:absolute;inset:0;pointer-events:none;opacity:.6;
    background-image:linear-gradient(180deg,rgba(16,16,16,0) 0%,rgba(16,16,16,.72) 66%,var(--obsidian) 100%),
      radial-gradient(var(--graphite) 1px,transparent 1.4px);
    background-size:100% 100%,26px 26px}
  .hero__in{position:relative}
  .kicker{font-family:var(--f-mono);font-size:13px;text-transform:uppercase;letter-spacing:-.02em;color:var(--smoke);margin-bottom:28px}
  h1{font-size:63px;line-height:1.05;letter-spacing:-.69px;font-weight:400;max-width:14ch}
  .sub{margin-top:24px;font-size:21px;line-height:1.3;color:var(--smoke);max-width:44ch}
  .badges{margin-top:40px;display:flex;flex-wrap:wrap;gap:12px}
  .badge{display:inline-flex;align-items:center;gap:10px;background:#1a1a1a;border:1px solid var(--graphite);
    border-radius:4px;padding:8px 14px;font-family:var(--f-mono);font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:var(--smoke)}
  .badge .g{width:6px;height:6px;border-radius:99px;background:var(--pulse)}
  .badge .a{width:6px;height:6px;border-radius:99px;background:var(--iron)}

  .rule{height:1px;background:var(--graphite);border:0;width:100%}

  .top5{padding:72px 0}
  .top5 h2,.sect__title{font-size:23px;font-weight:400;line-height:1.07}
  .top5 .lead{font-family:var(--f-mono);font-size:13px;text-transform:uppercase;letter-spacing:-.02em;color:var(--smoke);margin-bottom:28px}
  ol.tops{list-style:none;border-top:1px solid var(--graphite)}
  .top{display:grid;grid-template-columns:44px 1fr auto auto;align-items:baseline;gap:20px;
    padding:20px 0;border-bottom:1px solid var(--graphite)}
  .top__num{font-family:var(--f-mono);font-size:13px;color:var(--smoke)}
  .top__title{font-size:21px;letter-spacing:-.01em}
  .top__cat{font-family:var(--f-mono);font-size:12px;text-transform:uppercase;letter-spacing:.03em;color:var(--gold)}
  .top__score{font-size:16px;color:var(--chalk);white-space:nowrap}
  .top__score span{color:var(--smoke)}

  .sect{padding:72px 0}
  .sect__head{display:flex;align-items:center;gap:16px;margin-bottom:8px}
  .ico{width:28px;height:28px;color:var(--gold);flex:none}
  .sect__count{margin-left:auto;font-family:var(--f-mono);font-size:13px;text-transform:uppercase;letter-spacing:-.02em;color:var(--smoke)}
  .ev-list{border-top:1px solid var(--graphite);margin-top:24px}

  .ev{padding:32px 0;border-bottom:1px solid var(--graphite)}
  .ev__bar{display:grid;grid-template-columns:1fr auto;gap:16px 24px;align-items:start}
  .ev__title{font-size:21px;font-weight:400;letter-spacing:-.01em;line-height:1.15}
  .ev__meta{margin-top:12px;display:flex;flex-wrap:wrap;gap:8px;align-items:center;
    font-family:var(--f-mono);font-size:13px;letter-spacing:-.02em;color:var(--ash)}
  .ev__meta .muted{color:var(--smoke)}
  .ev__meta .dot{color:var(--iron)}
  .live{display:inline-flex;align-items:center;gap:7px;color:var(--chalk)}
  .live i{width:6px;height:6px;border-radius:99px;background:var(--pulse);display:inline-block;
    box-shadow:0 0 0 0 rgba(152,255,56,.5);animation:pulse 2s infinite}
  @keyframes pulse{0%{box-shadow:0 0 0 0 rgba(152,255,56,.45)}70%{box-shadow:0 0 0 7px rgba(152,255,56,0)}100%{box-shadow:0 0 0 0 rgba(152,255,56,0)}}
  .ev__score{text-align:right;white-space:nowrap;align-self:start}
  .ev__score-n{font-size:23px;letter-spacing:-.01em}
  .ev__score-d{font-size:13px;color:var(--smoke)}
  .meter{margin:18px 0 0;height:2px;background:var(--graphite);width:100%}
  .meter i{display:block;height:2px;background:var(--chalk)}
  .ev__desc{margin-top:18px;max-width:66ch;color:var(--smoke);line-height:1.5;font-size:16px}
  .ev__foot{margin-top:18px;display:flex;flex-wrap:wrap;gap:12px;align-items:center}
  .tags{display:flex;flex-wrap:wrap;gap:8px}
  .tag{font-family:var(--f-mono);font-size:12px;letter-spacing:-.01em;color:var(--ash);
    border:1px solid var(--iron);border-radius:4px;padding:4px 10px}
  .src{margin-left:auto;font-family:var(--f-mono);font-size:13px;text-transform:uppercase;letter-spacing:-.02em;
    color:var(--smoke);border-bottom:1px solid var(--iron);padding-bottom:2px}
  .src:hover{color:var(--chalk);border-color:var(--chalk)}

  footer{border-top:1px solid var(--graphite);padding:32px 0;margin-top:40px}
  .foot__in{display:flex;flex-wrap:wrap;gap:16px 32px;align-items:center;
    font-family:var(--f-mono);font-size:13px;letter-spacing:-.02em;color:var(--smoke)}
  .foot__in a{color:var(--ash)}
  .foot__in a:hover{color:var(--chalk)}
  .foot__note{margin-left:auto;max-width:52ch;text-align:right}

  @media (max-width:720px){
    .hero{padding:80px 0 56px}
    h1{font-size:40px;letter-spacing:-.02em}
    .sub{font-size:18px}
    .nav__links{display:none}
    .top{grid-template-columns:32px 1fr auto;gap:8px 14px}
    .top__cat{display:none}
    .ev__bar{grid-template-columns:1fr}
    .ev__score{text-align:left}
    .foot__note{text-align:left;margin-left:0}
  }
</style>
</head>
<body>
  <nav class="nav">
    <div class="nav__in">
      <div class="brand"><b>Event Radar</b></div>
      <div class="nav__links">
        <a href="#glasba">Glasba</a>
        <a href="#kultura">Kultura</a>
        <a href="#sport">Šport</a>
      </div>
      <div class="nav__cta"><a class="pill" href="events.ics">Izvozi koledar &#8599;</a></div>
    </div>
  </nav>

  <header class="hero">
    <div class="hero__dots"></div>
    <div class="wrap hero__in">
      <div class="kicker">Pregled dogodkov / ${esc(cfg.kraj)} + okolica</div>
      <h1>Kaj se dogaja ta teden.</h1>
      <p class="sub">${esc(cfg.kraj)} in okolica (${esc(naselja)}) · ${fmtDate(OD)} – ${fmtDate(DO)}. Zbrano, očiščeno in razvrščeno po odmevnosti.</p>
      <div class="badges">
        <span class="badge"><span class="a"></span>${events.length} dogodkov</span>
        <span class="badge"><span class="a"></span>razvrščeno: ${esc(RAZ)}</span>
        <span class="badge"><span class="g"></span>${events.filter(e => e.datum === TODAY).length} danes</span>
        <span class="badge"><span class="a"></span>osveženo ${stamp}</span>
      </div>
    </div>
  </header>

  <hr class="rule">

  <div class="wrap">
    <section class="top5">
      <div class="lead">Top 5 po odmevnosti</div>
      <ol class="tops">${topList}</ol>
    </section>
  </div>

  <hr class="rule">

  <div class="wrap">
    ${sections}
  </div>

  <footer>
    <div class="wrap foot__in">
      <a href="digest.md">digest.md</a>
      <a href="events.ics">events.ics</a>
      <a href="events.json">events.json</a>
      <span>zadnja osvežitev: ${stamp}</span>
      <span class="foot__note">Ocene odmevnosti so relativna razvrstitev znotraj tega nabora, ne absolutna resnica.</span>
    </div>
  </footer>
</body>
</html>`;
}

module.exports = { renderPage, MESECI, fmtStamp };
