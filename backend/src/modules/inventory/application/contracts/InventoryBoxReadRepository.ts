// import { PaginatedResult } from "@shared/application/dtos/PaginatedResult";
// import { PaginationRequest } from "@shared/application/dtos/PaginationRequest";
import { InventoryBoxDTO } from "../dto/InventoryBoxDTO";

export interface InventoryBoxReadRepository {
  getById(id: string): Promise<InventoryBoxDTO | null>;
  getByCode(code: string): Promise<InventoryBoxDTO | null>;
  // list(
  //   pagination: PaginationRequest,
  // ): Promise<PaginatedResult<InventoryBoxDTO>>;

  // getByVariantId(id: string): Promise<InventoryBoxDTO | null>;
}
