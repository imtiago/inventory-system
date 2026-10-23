import { PaginatedResult } from "@shared/application/dtos/PaginatedResult";
import { PaginationRequest } from "@shared/application/dtos/PaginationRequest";
import { SupplierDTO } from "../dto/SupplierDTO";

export interface SupplierListFilters {
  search?: string;
}

export interface SupplierReadRepository {
  list(pagination: PaginationRequest, filters?: SupplierListFilters): Promise<PaginatedResult<SupplierDTO>>;
  getById(id: string): Promise<SupplierDTO | null>;
}
