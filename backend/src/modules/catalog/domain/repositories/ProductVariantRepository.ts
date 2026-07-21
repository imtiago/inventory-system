// domain/repositories/ProductVariantRepository.ts
import { ProductVariant } from "../entities/ProductVariant";

export interface ProductVariantRepository {
  create(variant: ProductVariant): Promise<ProductVariant>;
  update(variant: ProductVariant): Promise<ProductVariant>;

  findById(id: string): Promise<ProductVariant | null>;
  findByProduct(productId: string): Promise<ProductVariant[]>;

  findByBarcode(barcode: string): Promise<ProductVariant | null>;
  findByCode(code: string): Promise<ProductVariant | null>;

  delete(id: string): Promise<void>;
}
