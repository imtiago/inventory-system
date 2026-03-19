// src/modules/products/types.ts
export interface Product {
  id: string;
  name: string;
  brandId?: string;
  categoryId?: string;
  variants?: any[];
}

export interface ProductWithNames extends Product {
  brandName: string;
  categoryName: string;
}
