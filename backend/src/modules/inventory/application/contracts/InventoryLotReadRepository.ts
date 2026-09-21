import { PaginatedResult } from "@shared/application/dtos/PaginatedResult";
import { PaginationRequest } from "@shared/application/dtos/PaginationRequest";
import { InventoryLotDTO } from "../dto/InventoryLotDTO";
export interface IGetByVariantId {
  producVariantId: string;
}
export interface InventoryLotReadRepository {
  getById(id: string): Promise<InventoryLotDTO | null>;
  // list(
  //   pagination: PaginationRequest,
  // ): Promise<PaginatedResult<InventoryLotDTO>>;

  getByVariantId(
    pagination: PaginationRequest,
    params: IGetByVariantId,
  ): Promise<PaginatedResult<InventoryLotDTO>>;
}
