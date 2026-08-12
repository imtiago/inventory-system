import { PaginationParams } from "@shared/application/pagination";
import { StockMovementReadRepository } from "../contracts/StockMovementReadRepository";

interface IListStockMovementsUseCase extends PaginationParams {
  inventoryId?: string;

  productVariantId?: string;

  type?: string;

  origin?: string;
}
export class ListStockMovementsUseCase {
  constructor(private repository: StockMovementReadRepository) {}

  async execute(request: IListStockMovementsUseCase) {
    return this.repository.list({
      ...request,
      pagination: { page: request.page, limit: request.limit },
    });
  }
}
