import { PaginatedResult } from "@shared/application/dtos/PaginatedResult";
import { PaginationRequest } from "@shared/application/dtos/PaginationRequest";
import { PurchaseDTO } from "../dto/PurchaseDTO";

export interface PurchaseReadRepository {
  list(pagination: PaginationRequest): Promise<PaginatedResult<PurchaseDTO>>;

  getById(id: string): Promise<PurchaseDTO | null>;
}
