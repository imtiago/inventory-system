import { PaginationParams } from "@shared/application/pagination";
import { ProductReadRepository } from "../contracts/ProductReadRepository";
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
