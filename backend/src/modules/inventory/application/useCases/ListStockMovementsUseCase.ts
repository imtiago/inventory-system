import { PaginationParams } from "@shared/application/pagination";
import { StockMovementReadRepository } from "../contracts/StockMovementReadRepository";

export class ListStockMovementsUseCase {
  constructor(private repository: StockMovementReadRepository) {}

  async execute({ page, limit }: PaginationParams) {
    return this.repository.list({ page, limit });
  }
}
