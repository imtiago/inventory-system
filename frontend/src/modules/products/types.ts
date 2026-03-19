import type { Brand } from "../brands/types";
import type { Category } from "../categories/types";

// src/modules/products/types.ts
export interface Product {
  id: string;
  name: string;
  price: number;
  stock: number; // adicionar se o backend retorna quantidade
  brandId: string;
  categoryId: string;
  barcode?: string; // novo campo
  brand?: Brand; // opcional, preenchido pela API
  category?: Category; // opcional, preenchido pela API
  // variants?: Variant[]; // se futuramente você for exibir variantes
}
