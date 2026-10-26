import { PaginatedResult } from "@shared/application/dtos/PaginatedResult";
import { PaginationRequest } from "@shared/application/dtos/PaginationRequest";
import { ProductVariantDTO } from "../dto/ProductVariantDTO";

export interface ProductVariantReadRepository {
  getByProductId(
    productId: string,
    pagination: PaginationRequest,
  ): Promise<PaginatedResult<ProductVariantDTO>>;

  getById(id: string): Promise<ProductVariantDTO | null>;
  /** Variantes pelos ids, numa só consulta (ids inexistentes ficam de fora; ordem não garantida). */
  getByIds(ids: string[]): Promise<ProductVariantDTO[]>;
  getByBarcode(barcode: string): Promise<ProductVariantDTO | null>;
}
