import { PaginatedResult } from "@shared/application/dtos/PaginatedResult";
import { InventoryWithExtendsDTO } from "../dto/InventoryDTO";
import { PaginationRequest } from "@shared/application/dtos/PaginationRequest";
import { InventoryDashboardDTO } from "../dto/InventoryDashboardDTO";

export interface InventoryReadRepository {
  getById(id: string): Promise<InventoryWithExtendsDTO | null>;
  list(
    pagination: PaginationRequest,
  ): Promise<PaginatedResult<InventoryWithExtendsDTO>>;
  getDashboard(): Promise<InventoryDashboardDTO>;
  getByVariantId(id: string): Promise<InventoryWithExtendsDTO | null>;
}
