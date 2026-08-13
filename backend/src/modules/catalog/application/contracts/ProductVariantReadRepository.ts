// application/queries/ProductQuery.ts

import { PaginatedResult } from "@shared/application/dtos/PaginatedResult";
import { ProductVariantDTO } from "../dto/ProductVariantDTO";
import { PaginationRequest } from "@shared/application/dtos/PaginationRequest";

export interface ProductVariantReadRepository {
  list(pagination: PaginationRequest): Promise<ProductVariantDTO>;

  getByProductId(
    productId: string,
    pagination: PaginationRequest,
  ): Promise<PaginatedResult<ProductVariantDTO>>;

  getById(id: string): Promise<ProductVariantDTO | null>;
  getByBarcode(barcode: string): Promise<ProductVariantDTO | null>;
}
