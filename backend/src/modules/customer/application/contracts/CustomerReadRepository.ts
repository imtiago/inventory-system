import { PaginatedResult } from "@shared/application/dtos/PaginatedResult";
import { PaginationRequest } from "@shared/application/dtos/PaginationRequest";
import { CustomerDTO } from "../dto/CustomerDTO";

export interface CustomerListFilters {
  search?: string;
}

export interface CustomerReadRepository {
  list(
    pagination: PaginationRequest,
    filters?: CustomerListFilters,
  ): Promise<PaginatedResult<CustomerDTO>>;

  getById(id: string): Promise<CustomerDTO | null>;
}
