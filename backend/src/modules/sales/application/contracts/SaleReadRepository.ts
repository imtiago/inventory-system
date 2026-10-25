import { PaginatedResult } from "@shared/application/dtos/PaginatedResult";
import { PaginationRequest } from "@shared/application/dtos/PaginationRequest";
import { SaleDetailDTO, SaleListItemDTO } from "../dto/SaleDTO";

export interface SaleListFilter {
  /** Dias de negócio (AAAA-MM-DD, America/Sao_Paulo), inclusivos. */
  from?: string;
  to?: string;
  status?: "PENDING" | "COMPLETED" | "CANCELED";
}

export interface SaleReadRepository {
  list(pagination: PaginationRequest, filter?: SaleListFilter): Promise<PaginatedResult<SaleListItemDTO>>;

  getById(id: string): Promise<SaleDetailDTO | null>;
}
