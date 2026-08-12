import { PaginatedResult } from "@shared/application/dtos/PaginatedResult";
import { InventoryDTO } from "../dto/InventoryDTO";
import { PaginationRequest } from "@shared/application/dtos/PaginationRequest";
import { InventoryDashboardDTO } from "../dto/InventoryDashboardDTO";

export interface InventoryReadRepository {
  getById(id: string): Promise<InventoryDTO | null>;
  list(pagination: PaginationRequest): Promise<PaginatedResult<InventoryDTO>>;
  getDashboard(): Promise<InventoryDashboardDTO>;
  getByVariantId(id: string): Promise<InventoryDTO | null>;
}
