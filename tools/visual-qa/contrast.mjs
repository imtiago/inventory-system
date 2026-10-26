// Contraste WCAG de todo texto visível em cada página/tema. Falha (exit 1) abaixo de 4,5 (texto normal) ou 3 (grande).
// Uso: node contrast.mjs [--out relatorio.json] [--widths 375,1440] [--themes light,dark]   (padrão: 1440)
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { launch } from './cdp.mjs';
import { BASE, THEMES, WIDTHS, HEIGHT_FOR, flag } from './config.mjs';
import { PAGES } from './pages.mjs';

const probe = `(() => {
 const parse = c => { const m = c.match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const p = m[1].split(/[ ,\\/]+/).filter(Boolean).map(Number); return [p[0],p[1],p[2],p[3]===undefined?1:p[3]]; };
 const lum = ([r,g,b]) => { const f = v => { v/=255; return v<=0.03928? v/12.92 : Math.pow((v+0.055)/1.055,2.4); }; return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b); };
 const blend = (fg, bg) => [0,1,2].map(i => fg[i]*fg[3] + bg[i]*(1-fg[3])).concat(1);
 const bgOf = el => { const stack=[]; for (let e=el; e; e=e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c[3]>0) { stack.push(c); if (c[3]>=1) break; } } let bg=[255,255,255,1]; for (let i=stack.length-1;i>=0;i--) bg = blend(stack[i], bg); return bg; };
 const hex = c => '#'+c.slice(0,3).map(v=>Math.round(v).toString(16).padStart(2,'0')).join('');
 const out = {};
 const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
 let n; while ((n = w.nextNode())) { const t = n.textContent.trim(); if (!t) continue; const el = n.parentElement; const cs = getComputedStyle(el); if (cs.visibility==='hidden' || el.offsetParent===null && cs.position!=='fixed') continue;
   const r = el.getBoundingClientRect(); if (!r.width) continue;
   let fg = parse(cs.color); const bg = bgOf(el); fg = blend(fg, bg);
   const L1 = lum(fg), L2 = lum(bg); const ratio = (Math.max(L1,L2)+0.05)/(Math.min(L1,L2)+0.05);
   const size = parseFloat(cs.fontSize), weight = parseInt(cs.fontWeight); const large = size>=24 || (size>=18.66 && weight>=700);
   const key = hex(fg)+' on '+hex(bg)+' '+(large?'L':'N');
   if (!out[key]) out[key] = { fg: hex(fg), bg: hex(bg), ratio: +ratio.toFixed(2), large, n: 0, samples: [], disabled: false };
   out[key].n++; if (out[key].samples.length<3 && !out[key].samples.includes(t.slice(0,40))) out[key].samples.push(t.slice(0,40));
   if (el.closest('[disabled],:disabled')) out[key].disabled = true;
 }
 return out; })()`;

const widths = flag('widths') || process.env.QA_WIDTHS ? WIDTHS : [1440];
const outFile = flag('out') || path.join(os.tmpdir(), 'visual-qa-contrast.json');
const b = await launch();
const all = {};
try {
  await b.goto(`${BASE}/login`, 600);
  for (const theme of THEMES) for (const w of widths) {
    await b.viewport(w, HEIGHT_FOR(w));
    for (const [, route, mode] of PAGES) {
      await b.prepare({ theme, auth: mode !== 'noauth' });
      await b.goto(BASE + route, 1800);
      const res = await b.eval(probe);
      for (const [k, v] of Object.entries(res)) {
        const key = `${theme}|${w}|${k}`;
        if (!all[key]) all[key] = { ...v, theme, width: w, routes: [] };
        else { all[key].n += v.n; for (const s of v.samples) if (all[key].samples.length < 4 && !all[key].samples.includes(s)) all[key].samples.push(s); }
        all[key].routes.push(route);
      }
    }
  }
} finally { await b.close(); }
const arr = Object.values(all).sort((a, b) => a.ratio - b.ratio);
fs.writeFileSync(outFile, JSON.stringify(arr, null, 1));
// Texto desabilitado é isento (WCAG 1.4.3).
const failures = arr.filter((x) => !x.disabled && x.ratio < (x.large ? 3 : 4.5));
for (const x of failures) console.log(`FALHA ${x.ratio} ${x.theme}/${x.width} ${x.fg} sobre ${x.bg} ${x.large ? 'grande' : 'normal'} x${x.n} "${x.samples.join(' | ')}" em ${[...new Set(x.routes)].slice(0, 4).join(', ')}`);
console.log(`relatório em ${outFile}; ${arr.length} combinações, ${failures.length} falha(s)`);
process.exit(failures.length ? 1 : 0);
