import { Product } from "../entities/Product";
import { ProductVariant } from "../entities/ProductVariant";

export interface ProductRepository {
  create(product: Product): Promise<Product>;
  findAll(page?: number, limit?: number): Promise<Product[]>; // ✅ paginação opcional
  createVariant(variant: ProductVariant): Promise<ProductVariant>;
  listVariants(productId: string): Promise<ProductVariant[]>;
}
