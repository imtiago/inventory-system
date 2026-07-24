import { PaginatedResult } from "@shared/application/dtos/PaginatedResult";
import { SaleDetailsDTO } from "../dto/SaleDTO";
import { PaginationRequest } from "@shared/application/dtos/PaginationRequest";

export interface SaleReadRepository {
  list(pagination: PaginationRequest): Promise<PaginatedResult<SaleDetailsDTO>>;

  getById(id: string): Promise<SaleDetailsDTO | null>;
}
