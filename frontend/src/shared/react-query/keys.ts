// src/shared/react-query/keys.ts

export const queryKeys = {
  products: ["products"] as const,

  product: (id: string) => ["products", id] as const,

  productVariants: (id: string) => ["products", id, "variants"] as const,

  brands: ["brands"] as const,

  categories: ["categories"] as const,
};
