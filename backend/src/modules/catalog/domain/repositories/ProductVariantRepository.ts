import { ProductVariant } from "../entities/ProductVariant";

export interface ProductVariantRepository {
  create(variant: ProductVariant): Promise<ProductVariant>;

  findByProduct(productId: string): Promise<ProductVariant[]>;
}
