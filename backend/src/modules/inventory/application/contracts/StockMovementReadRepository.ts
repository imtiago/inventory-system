import { PaginatedResult } from "@shared/application/dtos/PaginatedResult";
import { PaginationRequest } from "@shared/application/dtos/PaginationRequest";
import { StockMovementWithExtendsDTO } from "../dto/StockMovementDTO";

export interface StockMovementReadRepository {
  getById(id: string): Promise<StockMovementWithExtendsDTO | null>;
  list(
    pagination: PaginationRequest,
  ): Promise<PaginatedResult<StockMovementWithExtendsDTO>>;

  getByVariantId(id: string): Promise<StockMovementWithExtendsDTO | null>;
}
