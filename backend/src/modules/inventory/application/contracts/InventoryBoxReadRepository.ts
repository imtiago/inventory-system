// import { PaginatedResult } from "@shared/application/dtos/PaginatedResult";
// import { PaginationRequest } from "@shared/application/dtos/PaginationRequest";
import { PaginationRequest } from "@shared/application/dtos/PaginationRequest";
import { InventoryBoxDTO } from "../dto/InventoryBoxDTO";
import { PaginatedResult } from "@shared/application/dtos/PaginatedResult";
interface InventoryBoxParams {
  batchNumber: string;
  productVariantId: string;
}
export interface InventoryBoxReadRepository {
  getById(id: string): Promise<InventoryBoxDTO | null>;
  getByCode(code: string): Promise<InventoryBoxDTO | null>;
  getByLotAndProductVariantId(
    pagination: PaginationRequest,
    params?: InventoryBoxParams,
  ): Promise<PaginatedResult<InventoryBoxDTO>>;

  // list(
  //   pagination: PaginationRequest,
  // ): Promise<PaginatedResult<InventoryBoxDTO>>;

  // getByVariantId(id: string): Promise<InventoryBoxDTO | null>;
}
