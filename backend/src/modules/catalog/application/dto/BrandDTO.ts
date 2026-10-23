export interface BrandDTO {
  id: string;
  name: string;
  productsCount: number;
}

export interface ICreateBrandInput {
  name: string;
}

export interface IUpdateBrandInput {
  id: string;
  name: string;
}

export interface IDeleteBrandInput {
  id: string;
}
