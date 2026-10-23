import { BrandReadRepository } from "@catalog/application/contracts/BrandReadRepository";
import { NameSearchFilters } from "@catalog/application/contracts/NameSearchFilters";
import { BrandDTO } from "@catalog/application/dto/BrandDTO";
import { PaginatedResult } from "@shared/application/dtos/PaginatedResult";
import { PaginationRequest } from "@shared/application/dtos/PaginationRequest";

export class ListBrandsUseCase {
  constructor(private readonly repository: BrandReadRepository) {}

  async execute({ page, limit, search }: PaginationRequest & NameSearchFilters): Promise<PaginatedResult<BrandDTO>> {
    return this.repository.list({ page, limit }, { search });
  }
}
