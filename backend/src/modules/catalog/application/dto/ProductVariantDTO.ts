export interface ProductVariantDTO {
  id: string;

  productId: string;

  code: string;

  name: string;

  barcode: string | null;

  salePrice: number;

  createdAt: Date;
}
