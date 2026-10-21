// application/queries/ProductQuery.ts

import { PaginatedResult } from "@shared/application/dtos/PaginatedResult";
import { PaginationRequest } from "@shared/application/dtos/PaginationRequest";
import { SupplierDTO } from "../dto/SupplierDTO";

export interface SupplierReadRepository {
  list(pagination: PaginationRequest): Promise<SupplierDTO>;

  getByProductId(
    productId: string,
    pagination: PaginationRequest,
  ): Promise<PaginatedResult<SupplierDTO>>;

  getById(id: string): Promise<SupplierDTO | null>;
}
