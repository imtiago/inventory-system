export interface ProductVariantDTO {
  id: string;

  productId: string;

  code: string;

  name: string;

  barcode: string | null;

  salePrice: number;

  createdAt: Date;
}

/** Contrato HTTP da variante (spec 4B). */
export type VariantDTO = ProductVariantDTO;

export interface ICreateVariantInput {
  productId: string;
  name: string;
  // sku: string;
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
