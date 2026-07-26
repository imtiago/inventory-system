import { PaginatedResult } from "@shared/application/dtos/PaginatedResult";
import { InventoryDTO } from "../dto/InventoryDTO";
import { PaginationRequest } from "@shared/application/dtos/PaginationRequest";

export interface InventoryReadRepository {
  list(pagination: PaginationRequest): Promise<PaginatedResult<InventoryDTO>>;

  getByVariantId(id: string): Promise<InventoryDTO | null>;
}
