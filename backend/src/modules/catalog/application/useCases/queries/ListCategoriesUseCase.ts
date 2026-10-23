import { CategoryReadRepository } from "@catalog/application/contracts/CategoryReadRepository";
import { NameSearchFilters } from "@catalog/application/contracts/NameSearchFilters";
import { CategoryDTO } from "@catalog/application/dto/CategoryDTO";
import { PaginatedResult } from "@shared/application/dtos/PaginatedResult";
import { PaginationRequest } from "@shared/application/dtos/PaginationRequest";

export class ListCategoriesUseCase {
  constructor(private readonly repository: CategoryReadRepository) {}

  async execute({ page, limit, search }: PaginationRequest & NameSearchFilters): Promise<PaginatedResult<CategoryDTO>> {
    return this.repository.list({ page, limit }, { search });
  }
}
