import { CategoriesListDTO } from "../dto/CategoriesListDTO";

export interface CategoriesReadRepository {
  list(): Promise<CategoriesListDTO[]>;

  getById(id: string): Promise<CategoriesListDTO | null>;
}
