// Mock da API + servidor estático do build, para QA visual sem backend.
// Uso: node server.mjs <dist> [--port 4400] [--fixtures <frontend/src/test/fixtures>]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PORT, positional, flag } from './config.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(positional[0] ?? path.join(here, '../../frontend/dist'));
const FIX = path.resolve(flag('fixtures') || path.join(here, '../../frontend/src/test/fixtures'));
if (!fs.existsSync(path.join(DIST, 'index.html'))) { console.error(`Build não encontrado em ${DIST}. Rode o vite build com --outDir.`); process.exit(1); }

const j = (p) => JSON.parse(fs.readFileSync(path.join(FIX, p), 'utf8'));
const names = ['Ana Paula Ribeiro', 'Bruno Carvalho', 'Carla Mendes', 'Diego Ferreira', 'Eduarda Lima', 'Fábio Rocha', 'Gabriela Nunes', 'Henrique Alves'];

/** Repete itens da fixture para a lista parecer real (paginação de 3 páginas). */
function grow(list, n = 8) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const base = structuredClone(list.data[i % list.data.length]);
    if (i >= list.data.length) {
      base.id = base.id.slice(0, -2) + String(i).padStart(2, '0');
      if (base.code) base.code = base.code.slice(0, -2) + String(10 + i);
    }
    out.push(base);
  }
  return { ...list, data: out, pagination: { page: 1, limit: 10, total: 23, totalPages: 3 } };
}
// --role VENDEDOR simula o vendedor; --pending mostra a venda com pedido de cancelamento em aberto.
const me = { data: { id: 'u-admin', name: 'Tiago Oliveira', email: 'tiago@example.com', role: flag('role') || 'ADMIN' } };
const categories = { data: [{ id: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', name: 'Perfumes', productsCount: 8 }, { id: 'd4e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f80', name: 'Maquiagens', productsCount: 15 }, { id: 'c1', name: 'Cuidados com a pele', productsCount: 0 }], pagination: { page: 1, limit: 10, total: 3, totalPages: 1 } };

/** A fixture traz uma simulação só (contrato); a tela precisa das 27 linhas (à vista, débito e crédito 1x-12x). */
function pricingWithSimulations() {
  const base = j('pricing/variantPricing.json').data;
  const price = base.salePrice;
  const sims = [base.simulations[0]];
  const card = (condition, n, fee) => {
    const absorbed = price * (1 - fee);
    sims.push({ condition, installments: n, passOn: false, price, margin: { amount: Number((base.realMargin.amount - price * fee).toFixed(2)), percent: Number((base.realMargin.percent - fee * 100).toFixed(2)) } });
    sims.push({ condition, installments: n, passOn: true, price: Number((price / (1 - fee)).toFixed(2)), margin: base.realMargin });
    void absorbed;
  };
  card('DEBIT', 1, 0.0199);
  for (let n = 1; n <= 12; n++) card('CREDIT', n, 0.0299 + n * 0.0035);
  return { ...base, simulations: sims };
}

/** Simulação com 4 opções do crediário; disponível baixo para mostrar opções que pedem autorização. */
function saleSimulation() {
  const sim = j('sales/saleSimulation.json');
  const c = sim.data.crediario;
  const opt = (n, parcel, last, surcharge, pct) => ({ installments: n, downPayment: 47.91, installmentAmount: parcel, lastInstallmentAmount: last, total: Number((47.91 + parcel * (n - 1) + last).toFixed(2)), surcharge, surchargePercent: pct, margin: n === 4 ? null : { amount: Number((62.4 + surcharge).toFixed(2)), percent: 39.07 } });
  c.available = 120;
  c.maxInstallments = 4;
  c.options = [opt(1, 111.79, 111.79, 0, 0), opt(2, 55.9, 55.89, 0, 0), opt(3, 40.24, 40.25, 8.94, 8), opt(4, 30.69, 30.7, 10.98, 9.82)];
  return sim;
}

function route(method, url) {
  const u = new URL(url, 'http://x');
  const p = u.pathname.replace(/^\/api/, '');
  const s = p.split('/').filter(Boolean);
  if (method !== 'GET') {
    if (p === '/sales/simulate') return saleSimulation();
    if (p === '/auth/login') return { token: 'fake', user: me.data, data: { token: 'fake', user: me.data } };
    return { data: {} };
  }
  if (p === '/users/me') return me;
  if (p === '/dashboard') return j('dashboard/dashboard.json');
  if (p === '/reports/profit') return j('reports/profit.json');
  if (p === '/products') return grow(j('catalog/productList.json'));
  if (s[0] === 'products' && s[2] === 'variants') return j('catalog/variantList.json');
  if (s[0] === 'products' && s[1]) return j('catalog/productDetail.json');
  if (s[0] === 'variants' && s[1] === 'barcode') {
    const k = s[2].endsWith('1') ? 1 : 0;
    return { data: { id: `var-${k}`, productId: `p-${k}`, code: ['CAM-BAS-AZ-M', 'PERF-FLR-100'][k], name: ['Camiseta Básica Azul M', 'Perfume Floral 100ml — Refil com nome comprido para testar quebra'][k], barcode: s[2], salePrice: [39.9, 129.9][k] } };
  }
  if (s[0] === 'variants' && s[1]) return { data: j('catalog/variantList.json').data[0] };
  if (p === '/brands') return j('catalog/brandList.json');
  if (s[0] === 'brands') return { data: j('catalog/brandList.json').data[0] };
  if (p === '/categories') return categories;
  if (s[0] === 'categories') return { data: categories.data[0] };
  if (p === '/inventory') {
    const ids = u.searchParams.get('productVariantIds');
    if (ids) return { data: ids.split(',').map((productVariantId, i) => ({ productVariantId, quantity: 42 - i * 40, reserved: 2, available: 40 - i * 40 })) };
    return grow(j('inventory/inventoryList.json'));
  }
  if (p === '/inventory/boxes') return j('inventory/inventoryBoxList.json');
  if (s[0] === 'inventory' && s[1] === 'variants' && s[3] === 'lots') return j('inventory/inventoryLotList.json');
  if (s[0] === 'inventory') return j('inventory/inventory.json');
  if (p === '/sales') {
    const g = grow(j('sales/saleList.json'));
    g.data.forEach((r, i) => { if (r.customer) r.customer.name = names[i]; r.totalAmount = [159.7, 25, 1289.9, 74.5, 3420, 12.9, 560.4, 89.99][i]; });
    return g;
  }
  if (p === '/sales/cancel-requests/count') return j('sales/cancelRequestCount.json');
  if (p === '/sales/cancel-requests') return j('sales/cancelRequests.json');
  if (s[0] === 'sales' && s[1] === j('sales/saleDetailCrediario.json').data.id) return j('sales/saleDetailCrediario.json');
  if (s[0] === 'sales') {
    const detail = j('sales/saleDetail.json');
    if (flag('pending')) detail.data.pendingCancelRequest = j('sales/cancelRequests.json').data[0];
    return detail;
  }
  if (p === '/credit/review/preview') {
    const d = j('credit/creditReviewItems.json');
    const up = d.data[0];
    d.data.push(
      { ...up, customerId: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', customerName: 'Carlos Souza', fromProfile: 'GOOD', toProfile: 'REGULAR', fromLimit: 2500, toLimit: 800, action: 'DOWN', reason: 'desceu para Regular: atraso de 31 dias no período', score: 30 },
      { ...up, customerId: 'c3d4e5f6-a7b8-4c9d-8e1f-2a3b4c5d6e7f', customerName: 'Ana Lima', fromProfile: 'REGULAR', toProfile: 'REGULAR', fromLimit: 900, toLimit: 900, toStatus: 'SUSPENDED', action: 'SUSPEND', reason: 'suspenso: parcela vencida há 61 dias', score: 5 },
    );
    return d;
  }
  if (p === '/credit/limit-requests/count') return j('credit/creditLimitRequestCount.json');
  if (p === '/credit/limit-requests') return grow(j('credit/creditLimitRequests.json'), 4);
  if (s[0] === 'customers' && s[2] === 'credit') return j('credit/customerCredit.json');
  if (p === '/settings/store') return j('credit/storeSettings.json');
  if (p === '/credit/approvers') return j('credit/creditApprovers.json');
  if (p === '/credit/settings') return j('credit/creditSettings.json');
  if (p === '/credit/profiles') return j('credit/creditProfiles.json');
  if (p === '/customers') { const g = grow(j('customers/customerList.json')); g.data.forEach((r, i) => { if (i >= 2) r.name = names[i]; }); return g; }
  if (s[0] === 'customers') { const c = j('customers/customer.json'); if (flag('nophone')) c.data.phone = null; return c; }
  if (p === '/suppliers') return grow(j('purchases/supplierList.json'));
  if (s[0] === 'suppliers') return j('purchases/supplier.json');
  if (p === '/purchases') return grow(j('purchases/purchaseList.json'));
  if (s[0] === 'purchases') return j('purchases/purchaseDetail.json');
  if (p === '/nfe-imports') return grow(j('nfe/nfeImportList.json'), 4);
  if (s[0] === 'nfe-imports') return j('nfe/nfeImport.json');
  if (p === '/receivables') {
    const list = grow(j('finance/receivableList.json'));
    list.data[1] = { ...j('finance/receivableListLegacy.json').data[0], id: 'legacy1' }; // linha do caderninho (a combinar)
    return list;
  }
  if (s[0] === 'receivables' && s[4] === 'late-fees') return j('finance/lateFeeQuote.json');
  if (s[0] === 'receivables' && s[1] === 'legacy1') return j('finance/receivableDetailLegacy.json');
  if (s[0] === 'receivables' && s[1] === 'fees1') return j('finance/receivableDetailLateFees.json');
  if (s[0] === 'receivables') return j('finance/receivableDetail.json');
  if (p === '/legacy-imports') {
    // Lotes do caderninho: rascunho (CSV), confirmado e desfeito (lançamento rápido).
    const list = grow(j('legacy-import/legacyBatches.json'), 3);
    const confirmed = j('legacy-import/legacyBatchConfirmed.json').data;
    const { rows: _rows, ...header } = confirmed;
    list.data[1] = { ...header, id: 'confirmed1' };
    list.data[2] = { ...header, id: 'reverted1', status: 'REVERTED', revertedAt: '2026-11-01T16:00:00.000Z' };
    return { ...list, pagination: { page: 1, limit: 10, total: 3, totalPages: 1 } };
  }
  if (s[0] === 'legacy-imports' && s[1] === 'confirmed1') return { data: { ...j('legacy-import/legacyBatchConfirmed.json').data, id: 'confirmed1' } };
  if (s[0] === 'legacy-imports' && s[1] === 'clean1') {
    // Sem erro nem nome parecido pendente: o botão Confirmar fica liberado.
    const b = j('legacy-import/legacyBatchReview.json').data;
    b.rows = b.rows.filter((r) => r.line === 2 || r.line === 5);
    b.summary = { ...b.summary, rows: 2, warnings: 1, errors: 0, ignored: 0, newCustomers: 1, existingCustomers: 1, openTotal: 1400 };
    return { data: { ...b, id: 'clean1' } };
  }
  if (s[0] === 'legacy-imports' && s[1]) return j('legacy-import/legacyBatchReview.json');
  if (p === '/payables') return grow(j('finance/payableList.json'));
  if (s[0] === 'payables') return j('finance/payableDetail.json');
  if (p === '/pricing/settings') return j('pricing/pricingSettings.json');
  if (p === '/pricing/reviews/count') return j('pricing/priceReviewCount.json');
  if (p === '/pricing/reviews') return j('pricing/priceReviews.json');
  if (s[0] === 'pricing' && s[1] === 'variants' && s[2]) return { data: pricingWithSimulations() };
  if (p === '/users') return grow(j('users/userList.json'), 5);
  if (s[0] === 'users') return j('users/user.json');
  return null;
}

const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };
http.createServer((req, res) => {
  if (req.url.startsWith('/api/')) {
    let r;
    try { r = route(req.method, req.url); } catch (e) { r = null; console.error(e); }
    console.log(req.method, req.url, r ? 200 : 404);
    res.writeHead(r ? 200 : 404, { 'content-type': 'application/json', 'access-control-allow-origin': '*' });
    return res.end(JSON.stringify(r ?? { message: 'not found' }));
  }
  let f = path.join(DIST, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(DIST) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(DIST, 'index.html');
  res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}).listen(PORT, '127.0.0.1', () => console.log(`mock + build em http://127.0.0.1:${PORT} (dist=${DIST}, fixtures=${FIX})`));
