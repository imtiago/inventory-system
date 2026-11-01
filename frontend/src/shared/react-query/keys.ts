// src/shared/react-query/keys.ts

export const queryKeys = {
  me: ['auth', 'me'] as const,

  dashboard: ['dashboard'] as const,

  profitReport: (params: object) => ['reports', 'profit', params] as const,

  sales: ['sales'] as const,

  /** Simulação do fechamento (sob `sales`: invalidar vendas refaz a simulação). */
  saleSimulation: (params: object) => ['sales', 'simulate', params] as const,

  cancelRequests: ['cancel-requests'] as const,

  cancelRequestList: (params: object) => ['cancel-requests', 'list', params] as const,

  cancelRequestCount: ['cancel-requests', 'count'] as const,

  receivables: ['receivables'] as const,

  payables: ['payables'] as const,

  suppliers: ['suppliers'] as const,

  purchases: ['purchases'] as const,

  nfeImports: ['nfe-imports'] as const,

  products: ['products'] as const,

  customers: ['customers'] as const,

  users: ['users'] as const,

  product: (id: string) => ['products', id] as const,

  productVariants: (id: string) => ['products', id, 'variants'] as const,

  brands: ['brands'] as const,

  categories: ['categories'] as const,

  pricingSettings: ['pricing', 'settings'] as const,

  priceReviews: ['pricing', 'reviews'] as const,

  priceReviewList: (params: object) => ['pricing', 'reviews', 'list', params] as const,

  priceReviewCount: ['pricing', 'reviews', 'count'] as const,

  variantPricing: (id: string) => ['pricing', 'variants', id] as const,


  creditSettings: ['credit', 'settings'] as const,

  creditProfiles: ['credit', 'profiles'] as const,

  storeSettings: ['credit', 'store'] as const,

  creditRequests: ['credit', 'requests'] as const,

  creditRequestList: (params: object) => ['credit', 'requests', 'list', params] as const,

  creditRequestCount: ['credit', 'requests', 'count'] as const,

  creditReviewPreview: ['credit', 'review', 'preview'] as const,
  creditApprovers: ['credit', 'approvers'] as const,

  customerCredit: (id: string) => ['customers', id, 'credit'] as const,

  inventory: ['inventory'] as const,

  inventoryById: (id: string) => ['inventory', id] as const,

  inventoryByVariant: (variantId: string) => ['inventory', 'variant', variantId] as const,

  inventoryLots: (variantId: string) => ['inventory-lots', variantId] as const,

  inventoryBoxes: (search?: string) => ['inventory-boxes', search ?? ''] as const,

  inventoryBoxByCode: (code: string) => ['inventory-boxes', 'code', code] as const,
};
