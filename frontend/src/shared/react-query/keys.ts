// src/shared/react-query/keys.ts

export const queryKeys = {
  me: ['auth', 'me'] as const,

  dashboard: ['dashboard'] as const,

  profitReport: (params: object) => ['reports', 'profit', params] as const,

  sales: ['sales'] as const,

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

  variantPricing: (id: string) => ['pricing', 'variants', id] as const,

  profitReport: (params: object) => ['reports', 'profit', params] as const,

  inventory: ['inventory'] as const,

  inventoryById: (id: string) => ['inventory', id] as const,

  inventoryByVariant: (variantId: string) => ['inventory', 'variant', variantId] as const,

  inventoryLots: (variantId: string) => ['inventory-lots', variantId] as const,

  inventoryBoxes: (search?: string) => ['inventory-boxes', search ?? ''] as const,

  inventoryBoxByCode: (code: string) => ['inventory-boxes', 'code', code] as const,
};
