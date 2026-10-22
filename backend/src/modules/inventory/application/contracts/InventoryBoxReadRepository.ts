import { PaginationRequest } from "@shared/application/dtos/PaginationRequest";
import { PaginatedResult } from "@shared/application/dtos/PaginatedResult";
import {
  InventoryBoxDTO,
  InventoryBoxWithExtendsDTO,
} from "../dto/InventoryBoxDTO";

export interface InventoryBoxByLotParams {
  batchNumber: string;
  productVariantId: string;
}

export interface InventoryBoxListFilters {
  /** Trecho do código da caixa (sem diferenciar maiúsculas). */
  search?: string;
}

export interface InventoryBoxReadRepository {
  getById(id: string): Promise<InventoryBoxDTO | null>;
  getByCode(code: string): Promise<InventoryBoxWithExtendsDTO | null>;
  getByLotAndProductVariantId(
    pagination: PaginationRequest,
    params: InventoryBoxByLotParams,
  ): Promise<PaginatedResult<InventoryBoxWithExtendsDTO>>;
  list(
    pagination: PaginationRequest,
    filters?: InventoryBoxListFilters,
  ): Promise<PaginatedResult<InventoryBoxDTO>>;
}
