export interface ProductVariantDTO {
  id: string;
  productId: string;
  code: string;
  name: string;
  barcode: string | null;
  // salePrice: number;
  createdAt: Date;
}

/** Resumo da variante embutido nos DTOs de estoque (spec §5). */
export interface ProductVariantSummaryDTO {
  id: string;
  code: string;
  name: string;
  barcode: string | null;
  productId: string;
}

export interface UserDTO {
  id: string;
  name: string;
}
