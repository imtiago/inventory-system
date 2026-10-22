import { PaginatedResult } from "@shared/application/dtos/PaginatedResult";
import { PaginationRequest } from "@shared/application/dtos/PaginationRequest";
import { InventoryLotDTO } from "../dto/InventoryLotDTO";

export interface IGetByVariantId {
  productVariantId: string;
}

export interface InventoryLotReadRepository {
  getById(id: string): Promise<InventoryLotDTO | null>;

  /** Lotes da variante, mais recentes primeiro (`createdAt desc`). */
  getByVariantId(
    pagination: PaginationRequest,
    params: IGetByVariantId,
  ): Promise<PaginatedResult<InventoryLotDTO>>;
}
