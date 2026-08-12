import { PaginatedResult } from "@shared/application/dtos/PaginatedResult";
import { PaginationRequest } from "@shared/application/dtos/PaginationRequest";
import { StockMovementWithExtendsDTO } from "../dto/StockMovementDTO";
export interface IList {
  inventoryId?: string;
  productVariantId?: string;
  type?: string;
  origin?: string;
  pagination: PaginationRequest;
}
export interface StockMovementReadRepository {
  getById(id: string): Promise<StockMovementWithExtendsDTO | null>;
  list(params: IList): Promise<PaginatedResult<StockMovementWithExtendsDTO>>;

  getByVariantId(id: string): Promise<StockMovementWithExtendsDTO | null>;
}
