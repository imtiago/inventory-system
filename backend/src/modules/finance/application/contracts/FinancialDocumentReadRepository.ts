// application/queries/ProductQuery.ts

import { PaginatedResult } from "@shared/application/dtos/PaginatedResult";
import { FinancialDocumentDTO } from "../dto/FinancialDocumentDTO";
import { PaginationRequest } from "@shared/application/dtos/PaginationRequest";

export interface FinancialDocumentReadRepository {
  listReceivables(
    pagination: PaginationRequest,
  ): Promise<PaginatedResult<FinancialDocumentDTO>>;
  listPayables(
    pagination: PaginationRequest,
  ): Promise<PaginatedResult<FinancialDocumentDTO>>;
  list(
    pagination: PaginationRequest,
  ): Promise<PaginatedResult<FinancialDocumentDTO>>;

  // getById(id: string): Promise<ProductListDTO | null>;
}
