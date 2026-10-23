import { PaginatedResult } from "@shared/application/dtos/PaginatedResult";
import { PaginationRequest } from "@shared/application/dtos/PaginationRequest";
import { PurchaseStatus } from "@purchases/domain/enums/PurchaseStatus";
import { PurchaseDTO, PurchaseListItemDTO } from "../dto/PurchaseDTO";

export interface PurchaseListFilters {
  status?: PurchaseStatus;
  supplierId?: string;
  /** purchaseDate ≥ from ("YYYY-MM-DD"). */
  from?: string;
  /** purchaseDate ≤ to ("YYYY-MM-DD"). */
  to?: string;
  /** Trecho do código (sem diferença de caixa). */
  search?: string;
}

export interface PurchaseReadRepository {
  list(pagination: PaginationRequest, filters?: PurchaseListFilters): Promise<PaginatedResult<PurchaseListItemDTO>>;
  getById(id: string): Promise<PurchaseDTO | null>;
}
