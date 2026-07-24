// application/queries/ProductQuery.ts

import { PaginatedResult } from "@shared/application/dtos/PaginatedResult";
import { ProductListDTO } from "../dto/ProductListDTO";
import { PaginationRequest } from "@shared/application/dtos/PaginationRequest";

export interface ProductReadRepository {
  list(pagination: PaginationRequest): Promise<PaginatedResult<ProductListDTO>>;

  getById(id: string): Promise<ProductListDTO | null>;
}
