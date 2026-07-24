import { PaginationParams } from "@shared/application/pagination";
import { ProductReadRepository } from "../contracts/ProductReadRepository";

export class ListProductsUseCase {
  constructor(private readonly repository: ProductReadRepository) {}
  async execute({ page, limit }: PaginationParams) {
    return await this.repository.list({
      page,
      limit,
    });
  }
}
