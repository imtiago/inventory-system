export interface CategoryDTO {
  id: string;

  name: string;
}

export interface ICreateCategoryInput {
  name: string;
}
export interface ICategoryOutput {
  id: string;
  name: string;
}
