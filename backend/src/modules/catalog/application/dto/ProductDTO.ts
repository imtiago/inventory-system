export interface ProductDetailDTO {
  id: string;
  code: string;
  name: string;
  description: string | null;
  brand: { id: string; name: string };
  category: { id: string; name: string };
  variantsCount: number;
  createdAt: Date;
}

export type ProductListItemDTO = ProductDetailDTO;

export interface ICreateProductInput {
  name: string;
  description?: string | null;
  brandId: string;
  categoryId: string;
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
