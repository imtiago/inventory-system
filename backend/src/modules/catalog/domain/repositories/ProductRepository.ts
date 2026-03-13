// backend/src/modules/catalog/domain/repositories/ProductRepository.ts
import { Product } from "../entities/Product";
import { ProductVariant } from "../entities/ProductVariant";
import { Brand } from "../entities/Brand";
import { Category } from "../entities/Category";

export interface ProductRepository {
  create(product: Product): Promise<Product>;
  list(page: number, limit: number): Promise<Product[]>;
  getById(id: string): Promise<Product | null>;
  createVariant(variant: ProductVariant): Promise<ProductVariant>;
  listBrands(): Promise<Brand[]>;
  createBrand(brand: Brand): Promise<Brand>;
  listCategories(): Promise<Category[]>;
  createCategory(category: Category): Promise<Category>;
  findAll?(): Promise<Product[]>; // ou opcional
  findVariantsByProductId(productId: string): Promise<ProductVariant[]>;
}
