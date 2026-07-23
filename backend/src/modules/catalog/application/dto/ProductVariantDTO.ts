export interface ProductVariantDTO {
  id: string;

  productId: string;

  productName: string;

  code: string;

  name: string;

  barcode: string | null;

  salePrice: number;
}
