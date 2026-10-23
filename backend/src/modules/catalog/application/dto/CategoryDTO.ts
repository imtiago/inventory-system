export interface CategoryDTO {
  id: string;
  name: string;
  productsCount: number;
}

export interface ICreateCategoryInput {
  name: string;
}

export interface IUpdateCategoryInput {
  id: string;
  name: string;
}

export interface IDeleteCategoryInput {
  id: string;
}
