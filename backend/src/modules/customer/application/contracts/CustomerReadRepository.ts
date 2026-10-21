// application/queries/ProductQuery.ts

import { PaginatedResult } from "@shared/application/dtos/PaginatedResult";
import { CustomerDetailsDTO } from "../dto/CustomerDTO";
import { PaginationRequest } from "@shared/application/dtos/PaginationRequest";

export interface CustomerReadRepository {
  list(
    pagination: PaginationRequest,
  ): Promise<PaginatedResult<CustomerDetailsDTO>>;

  getById(id: string): Promise<CustomerDetailsDTO | null>;
}
