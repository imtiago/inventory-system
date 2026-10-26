// Abre modais e fluxos curtos (criação, cancelamento, pagamento...) e captura cada um.
// Uso: node interact.mjs [--out dir] [--widths 375,1440] [--themes light,dark] [--only brand-create,payment-modal]
import path from 'node:path';
import { launch } from './cdp.mjs';
import { BASE, OUT, WIDTHS, THEMES, ONLY, HEIGHT_FOR } from './config.mjs';

const H = `window.__h = {
  setVal(el, v) { const proto = el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:el.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto,'value').set.call(el, v); el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); },
  byText(sel, t) { return [...document.querySelectorAll(sel)].find(e => e.textContent.trim().includes(t) && !e.disabled); },
  click(sel, t) { const e = t ? this.byText(sel, t) : document.querySelector(sel); if (!e) throw new Error('nf '+sel+' '+t); e.click(); return true; },
};1`;
// [rota, [passo, espera em ms, passo, espera, ...]]
const scan = (code) => `(async()=>{ const i=document.querySelector('input[placeholder="Código de barras"]'); __h.setVal(i,'${code}'); __h.click('button','Adicionar'); })()`;
const flows = {
  'sale-new-items': ['/sales/new', [
    `(async()=>{ const i=document.querySelector('input[placeholder*="nome do cliente"]'); i.focus(); __h.setVal(i,'Ana'); })()`, 1200,
    `(async()=>{ const o=document.querySelector('[role=option]'); if(o){ o.dispatchEvent(new MouseEvent('mousedown',{bubbles:true})); o.click(); } return !!o })()`, 600,
    scan('7890'), 900, scan('7891'), 900, scan('7890'), 900,
  ]],
  'purchase-new-items': ['/purchases/new', [scan('7890'), 900, scan('7891'), 900]],
  'payment-modal': ['/receivables/x1', [`[...document.querySelectorAll('button')].filter(b=>b.textContent.includes('Registrar pagamento')&&!b.disabled)[0].click()`, 900]],
  'reverse-modal': ['/receivables/x1', [`__h.click('button','Estornar')`, 900]],
  'change-password': ['/', [`__h.click('button','Alterar senha')`, 900]],
  'brand-create': ['/brands', [`__h.click('button','Nova marca')`, 900]],
  'category-create': ['/categories', [`__h.click('button','Nova categoria')`, 900]],
  'customer-create': ['/customers', [`__h.click('button','Novo Cliente')`, 900]],
  'supplier-create': ['/suppliers', [`__h.click('button','Novo fornecedor')`, 900]],
  'user-create': ['/users', [`__h.click('button','Novo usuário')`, 900]],
  'product-delete': ['/products', [`document.querySelector('button[aria-label*="xcluir"], button[title*="xcluir"]').click()`, 900]],
  'sale-cancel': ['/sales/0b6f3c2e-8a4d-4f1b-9c7e-2d5a8f1e3b40', [`__h.click('button','Cancelar venda')`, 900]],
  'purchase-receipt': ['/purchases/x1', [`__h.click('button','Registrar recebimento')`, 900]],
  'inventory-initial-nobarcode': ['/inventory/initial', [`__h.click('button','Cadastrar sem código')`, 1200]],
  'nfe-upload': ['/nfe-imports', [`__h.click('button','Enviar XML')`, 900]],
};
const extraScroll = "Math.max(0,...[...document.querySelectorAll('*')].filter(e=>e.tagName!=='NAV'&&/(auto|scroll)/.test(getComputedStyle(e).overflowY)&&e.scrollHeight>e.clientHeight+2).map(e=>e.scrollHeight-e.clientHeight))";

const b = await launch();
try {
  await b.goto(`${BASE}/login`, 800);
  for (const theme of THEMES) for (const w of WIDTHS) {
    const h = HEIGHT_FOR(w);
    await b.viewport(w, h);
    for (const [name, [route, steps]] of Object.entries(flows)) {
      if (ONLY && !ONLY.includes(name)) continue;
      await b.prepare({ theme });
      await b.goto(BASE + route, 1800);
      await b.eval(H);
      for (let i = 0; i < steps.length; i += 2) {
        try { await b.eval(steps[i]); } catch (e) { console.log(name, 'passo', i / 2, e.message.slice(0, 200)); }
        await b.sleep(steps[i + 1]);
      }
      await b.shot(path.join(OUT, `${name}-${w}-${theme}.png`));
      const extra = await b.eval(extraScroll);
      if (extra > 4 && !name.includes('modal')) { await b.viewport(w, Math.min(h + extra, 5000)); await b.sleep(400); await b.shot(path.join(OUT, `${name}-${w}-${theme}-full.png`)); await b.viewport(w, h); }
    }
  }
} finally { await b.close(); }
console.log(`capturas em ${OUT}`);
