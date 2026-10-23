import { ProductReadRepository } from "@catalog/application/contracts/ProductReadRepository";
import { ProductListFilters } from "@catalog/application/contracts/ProductListFilters";
import { PaginationParams } from "@shared/application/pagination";

interface ListProductsParams extends PaginationParams, ProductListFilters {}

export class ListProductsUseCase {
  constructor(private readonly repository: ProductReadRepository) {}

  async execute({ page, limit, ...filters }: ListProductsParams) {
    return this.repository.list({ page, limit }, filters);
  }
}
