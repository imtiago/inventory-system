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
  salePrice?: number;
}

export interface IDeleteProductVariantInput {
  id: string;
}

export interface IProductVariantOutput {
  id: string;
  productId: string;
  code: string;
  name: string;
  barcode: string | null;
  salePrice: number;
}

export interface IUpdateVariantInput {
  id: string;
  name?: string;
  barcode?: string | null;
  salePrice?: number;
}
