import { ProductReadRepository } from "@catalog/application/contracts/ProductReadRepository";
import { PaginationParams } from "@shared/application/pagination";
interface ListProductsParams extends PaginationParams {
  search?: string;
}

export class ListProductsUseCase {
  constructor(private readonly repository: ProductReadRepository) {}
  async execute({ page, limit, search }: ListProductsParams) {
    return await this.repository.list(
      {
        page,
        limit,
      },
      { search },
    );
  }
}
