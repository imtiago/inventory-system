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
const me = { data: { id: 'u-admin', name: 'Tiago Oliveira', email: 'tiago@example.com', role: 'ADMIN' } };
const categories = { data: [{ id: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', name: 'Perfumes', productsCount: 8 }, { id: 'd4e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f80', name: 'Maquiagens', productsCount: 15 }, { id: 'c1', name: 'Cuidados com a pele', productsCount: 0 }], pagination: { page: 1, limit: 10, total: 3, totalPages: 1 } };

function route(method, url) {
  const u = new URL(url, 'http://x');
  const p = u.pathname.replace(/^\/api/, '');
  const s = p.split('/').filter(Boolean);
  if (method !== 'GET') {
    if (p === '/auth/login') return { token: 'fake', user: me.data, data: { token: 'fake', user: me.data } };
    return { data: {} };
  }
  if (p === '/users/me') return me;
  if (p === '/dashboard') return j('dashboard/dashboard.json');
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
  if (s[0] === 'sales') return j('sales/saleDetail.json');
  if (p === '/customers') { const g = grow(j('customers/customerList.json')); g.data.forEach((r, i) => { if (i >= 2) r.name = names[i]; }); return g; }
  if (s[0] === 'customers') return j('customers/customer.json');
  if (p === '/suppliers') return grow(j('purchases/supplierList.json'));
  if (s[0] === 'suppliers') return j('purchases/supplier.json');
  if (p === '/purchases') return grow(j('purchases/purchaseList.json'));
  if (s[0] === 'purchases') return j('purchases/purchaseDetail.json');
  if (p === '/nfe-imports') return grow(j('nfe/nfeImportList.json'), 4);
  if (s[0] === 'nfe-imports') return j('nfe/nfeImport.json');
  if (p === '/receivables') return grow(j('finance/receivableList.json'));
  if (s[0] === 'receivables') return j('finance/receivableDetail.json');
  if (p === '/payables') return grow(j('finance/payableList.json'));
  if (s[0] === 'payables') return j('finance/payableDetail.json');
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
