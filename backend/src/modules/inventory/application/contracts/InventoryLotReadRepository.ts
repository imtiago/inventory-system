import { PaginatedResult } from "@shared/application/dtos/PaginatedResult";
import { PaginationRequest } from "@shared/application/dtos/PaginationRequest";

export interface InventoryLotReadRepository {
  getById(id: string): Promise<InventoryLotDTO | null>;
  list(
    pagination: PaginationRequest,
  ): Promise<PaginatedResult<InventoryLotDTO>>;

  getByVariantId(id: string): Promise<InventoryLotDTO | null>;
}
