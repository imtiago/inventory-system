import { CategoriesReadRepository } from "../contracts/CategoriesReadRepository";
import { CategoriesListDTO } from "../dto/CategoriesListDTO";

export class GetCategoriesUseCase {
  constructor(private repository: CategoriesReadRepository) {}

  // async execute(page: number = 1, limit: number = 10): Promise<Category[]> {
  async execute(): Promise<CategoriesListDTO[]> {
    // return this.repository.list(page, limit);
    return this.repository.list();
  }
}
