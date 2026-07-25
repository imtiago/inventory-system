// modules/products/constants/queryKeys.ts

export const productQueryKeys = {
  products: ["products"] as const,

  product(id: string) {
    return ["products", id] as const;
  },

  variants(productId: string) {
    return ["products", productId, "variants"] as const;
  },
} as const;
