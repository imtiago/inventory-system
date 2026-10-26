// Rotas cobertas pelas capturas e pela medição de contraste (ids vêm das fixtures).
export const PAGES = [
  ['login', '/login', 'noauth'],
  ['dashboard', '/'], ['products', '/products'], ['product-detail', '/products/3f1c2a7e-9b4d-4e21-8a6f-1c2d3e4f5a60'],
  ['product-new', '/products/new'], ['product-edit', '/products/3f1c2a7e-9b4d-4e21-8a6f-1c2d3e4f5a60/edit'],
  ['variant-new', '/products/3f1c2a7e-9b4d-4e21-8a6f-1c2d3e4f5a60/variants/new'],
  ['brands', '/brands'], ['categories', '/categories'],
  ['inventory', '/inventory'], ['inventory-detail', '/inventory/5f1c2a9e-3b7d-4c1e-9a2f-6d8e0b4c7a11'], ['inventory-initial', '/inventory/initial'],
  ['sales', '/sales'], ['sale-new', '/sales/new'], ['sale-detail', '/sales/0b6f3c2e-8a4d-4f1b-9c7e-2d5a8f1e3b40'],
  ['customers', '/customers'], ['customer-detail', '/customers/a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'],
  ['suppliers', '/suppliers'], ['purchases', '/purchases'], ['purchase-new', '/purchases/new'], ['purchase-detail', '/purchases/x1'],
  ['nfe', '/nfe-imports'], ['nfe-review', '/nfe-imports/x1'],
  ['receivables', '/receivables'], ['receivable-detail', '/receivables/x1'], ['payables', '/payables'], ['payable-detail', '/payables/x1'],
  ['users', '/users'],
];
