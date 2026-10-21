import { PaginationParams } from "@shared/application/pagination";
import { BrandReadRepository } from "../../contracts/PurchaseReadRepository";

export class ListBrandsUseCase {
  constructor(private readonly brandQuery: BrandReadRepository) {}

  async execute({ page, limit }: PaginationParams) {
    return this.brandQuery.list({ page, limit });
  }
}
