import { PaginatedResult } from "@shared/application/dtos/PaginatedResult";
import { PaginationRequest } from "@shared/application/dtos/PaginationRequest";
import { ProductVariantDTO } from "../dto/ProductVariantDTO";

export interface ProductVariantReadRepository {
  getByProductId(
    productId: string,
    pagination: PaginationRequest,
  ): Promise<PaginatedResult<ProductVariantDTO>>;

  getById(id: string): Promise<ProductVariantDTO | null>;
  getByBarcode(barcode: string): Promise<ProductVariantDTO | null>;
}
