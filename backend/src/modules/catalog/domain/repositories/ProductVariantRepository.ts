// domain/repositories/ProductVariantRepository.ts
import { ICrudRepository } from "@shared/domain/repositories/CrudRepository";
import { ProductVariant } from "../entities/ProductVariant";

export interface ProductVariantRepository extends ICrudRepository<ProductVariant> {
  findByProduct(productId: string): Promise<ProductVariant[]>;
  findByBarcode(barcode: string): Promise<ProductVariant | null>;
  findByCode(code: string): Promise<ProductVariant | null>;
}
