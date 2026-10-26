// Capturas de todas as páginas em várias larguras e temas, com checagem de rolagem horizontal.
// Uso: node run.mjs [--out dir] [--widths 375,1440] [--themes light,dark] [--only dashboard,sales]
import path from 'node:path';
import { launch } from './cdp.mjs';
import { BASE, OUT, WIDTHS, THEMES, ONLY, HEIGHT_FOR } from './config.mjs';
import { PAGES } from './pages.mjs';

const overflowX = "(() => { const m = document.querySelector('main') || document.documentElement; return m.scrollWidth - m.clientWidth; })()";
const extraScroll = "Math.max(0,...[...document.querySelectorAll('*')].filter(e=>e.tagName!=='NAV'&&/(auto|scroll)/.test(getComputedStyle(e).overflowY)&&e.scrollHeight>e.clientHeight+2).map(e=>e.scrollHeight-e.clientHeight))";

const b = await launch();
let bad = 0;
try {
  await b.goto(`${BASE}/login`, 800);
  for (const theme of THEMES) for (const w of WIDTHS) {
    const h = HEIGHT_FOR(w);
    await b.viewport(w, h);
    for (const [name, route, mode] of PAGES) {
      if (ONLY && !ONLY.includes(name)) continue;
      await b.prepare({ theme, auth: mode !== 'noauth' });
      await b.goto(BASE + route, 1800);
      await b.shot(path.join(OUT, `${name}-${w}-${theme}.png`));
      const over = await b.eval(overflowX);
      if (over > 0) { bad++; console.log(`ROLAGEM HORIZONTAL ${name} ${w} ${theme}: +${over}px`); }
      const extra = await b.eval(extraScroll);
      if (extra > 4) { await b.viewport(w, Math.min(h + extra, 5000)); await b.sleep(400); await b.shot(path.join(OUT, `${name}-${w}-${theme}-full.png`)); await b.viewport(w, h); }
    }
  }
} finally { await b.close(); }
console.log(`capturas em ${OUT}; ${bad} página(s) com rolagem horizontal`);
process.exit(bad ? 1 : 0);
