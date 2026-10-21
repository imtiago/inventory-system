import { BrandReadRepository } from "@catalog/application/contracts/BrandReadRepository";
import { PaginationParams } from "@shared/application/pagination";

export class ListBrandsUseCase {
  constructor(private readonly brandQuery: BrandReadRepository) {}

  async execute({ page, limit }: PaginationParams) {
    return this.brandQuery.list({ page, limit });
  }
}
