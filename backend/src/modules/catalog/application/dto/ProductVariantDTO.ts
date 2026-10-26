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
  barcode?: string;
  salePrice?: number;
  /** Quem tem `catalog.price` (só ADMIN). Sem ele, o preço inicial é obrigatório. */
  canSetPrice: boolean;
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
  /** Quem tem `catalog.price` (só ADMIN). Sem ele, só é aceito o preço igual ao atual. */
  canChangePrice: boolean;
}
