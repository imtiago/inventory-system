import { PaginatedResult } from "@shared/application/dtos/PaginatedResult";
import { PaginationRequest } from "@shared/application/dtos/PaginationRequest";
import { ProductDetailDTO, ProductListItemDTO } from "../dto/ProductDTO";
import { ProductListFilters } from "./ProductListFilters";

export interface ProductReadRepository {
  list(
    pagination: PaginationRequest,
    filters?: ProductListFilters,
  ): Promise<PaginatedResult<ProductListItemDTO>>;

  getById(id: string): Promise<ProductDetailDTO | null>;
}
