export interface ProductVariantDTO {
  id: string;

  productId: string;

  code: string;

  name: string;

  barcode: string | null;

  salePrice: number;

  createdAt: Date;
}

export interface ICreateVariantInput {
  productId: string;
  name: string;
  // sku: string;
  barcode?: string;
}

export interface IDeleteProductVariantInput {
  id: string;
}
