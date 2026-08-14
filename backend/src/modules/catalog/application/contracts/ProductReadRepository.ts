import { PaginatedResult } from "@shared/application/dtos/PaginatedResult";
import { ProductListDTO } from "../dto/ProductListDTO";
import { PaginationRequest } from "@shared/application/dtos/PaginationRequest";
import { ProductListFilters } from "./ProductListFilters";

export interface ProductReadRepository {
  list(
    pagination: PaginationRequest,
    filters?: ProductListFilters,
  ): Promise<PaginatedResult<ProductListDTO>>;

  getById(id: string): Promise<ProductListDTO | null>;
}
