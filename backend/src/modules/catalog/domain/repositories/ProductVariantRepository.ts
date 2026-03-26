import { ProductVariant } from "../entities/ProductVariant";

export interface ProductVariantRepository {
  create(variant: ProductVariant): Promise<ProductVariant>;
  count(): Promise<number>;
  findByProduct(productId: string): Promise<ProductVariant[]>;
}
