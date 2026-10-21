import { CategoriesReadRepository } from "@catalog/application/contracts/CategoriesReadRepository";
import { CategoryDTO } from "@catalog/application/dto/CategoryDTO";
import { PaginationParams } from "@shared/application/pagination";

export class GetCategoriesUseCase {
  constructor(private repository: CategoriesReadRepository) {}

  async execute({ page, limit }: PaginationParams): Promise<CategoryDTO[]> {
    return this.repository.list({ page, limit });
  }
}
