// src/shared/react-query/keys.ts

export const queryKeys = {
  sales: ['sales'] as const,

  products: ['products'] as const,

  customers: ['customers'] as const,

  product: (id: string) => ['products', id] as const,

  productVariants: (id: string) => ['products', id, 'variants'] as const,

  brands: ['brands'] as const,

  categories: ['categories'] as const,
};
