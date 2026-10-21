export interface ProductDTO {
  id: string;

  code: string;

  name: string;
  description?: string;

  brand: {
    id: string;
    name: string;
  };

  category: {
    id: string;
    name: string;
  };

  variantsCount: number;
}

export interface ICreateProductInput {
  name: string;
  description?: string;
  brandId: string;
  categoryId: string;
}
export interface IDeleteProductInput {
  id: string;
}

export interface IUpdateProductInput {
  id: string;
}
