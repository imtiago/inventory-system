import { PaginationParams } from "@shared/application/pagination";
import { CategoriesReadRepository } from "../contracts/CategoriesReadRepository";
import { CategoriesListDTO } from "../dto/CategoriesListDTO";

export class GetCategoriesUseCase {
  constructor(private repository: CategoriesReadRepository) {}

  async execute({
    page,
    limit,
  }: PaginationParams): Promise<CategoriesListDTO[]> {
    return this.repository.list({ page, limit });
  }
}
