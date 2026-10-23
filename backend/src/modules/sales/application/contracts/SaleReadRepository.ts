import { PaginatedResult } from "@shared/application/dtos/PaginatedResult";
import { PaginationRequest } from "@shared/application/dtos/PaginationRequest";
import { SaleDetailDTO, SaleListItemDTO } from "../dto/SaleDTO";

export interface SaleReadRepository {
  list(pagination: PaginationRequest): Promise<PaginatedResult<SaleListItemDTO>>;

  getById(id: string): Promise<SaleDetailDTO | null>;
}
