export interface ProductDetailDTO {
  id: string;
  code: string;
  name: string;
  description: string | null;
  brand: { id: string; name: string };
  category: { id: string; name: string };
  variantsCount: number;
  createdAt: Date;
  /** Interno: a camada HTTP troca por `targetMarginPercent` (só `pricing.manage`) e remove. */
  targetMarginBps?: number | null;
}

export type ProductListItemDTO = ProductDetailDTO;

export interface ICreateProductInput {
  name: string;
  description?: string | null;
  brandId: string;
  categoryId: string;
  /** Variante inicial; ausente → variante "Padrão" sem código de barras e preço 0. */
  variant?: { name: string; barcode?: string | null; salePrice?: number };
}

export interface IUpdateProductInput {
  id: string;
  name?: string;
  description?: string | null;
  brandId?: string;
  categoryId?: string;
}

export interface IDeleteProductInput {
  id: string;
}
