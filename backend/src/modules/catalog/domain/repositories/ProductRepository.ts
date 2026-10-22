// backend/src/modules/catalog/domain/repositories/ProductRepository.ts
import { Product } from "../entities/Product";
import { ProductVariant } from "../entities/ProductVariant";
import { Brand } from "../entities/Brand";
import { Category } from "../entities/Category";
import { ProductListDTO } from "@catalog/application/dto/ProductDTO";
import { ICrudRepository } from "@shared/domain/repositories/CrudRepository";

export interface ProductRepository extends ICrudRepository<Product> {
  list(page: number, limit: number): Promise<Product[]>;
  createVariant(variant: ProductVariant): Promise<ProductVariant>;
  listBrands(): Promise<Brand[]>;
  createBrand(brand: Brand): Promise<Brand>;
  listCategories(): Promise<Category[]>;
  createCategory(category: Category): Promise<Category>;
  findAll?(): Promise<Product[]>; // ou opcional
  findVariantsByProductId(productId: string): Promise<ProductVariant[]>;

  findProductsForList(): Promise<ProductListDTO[]>;
  // ✅ Métodos adicionados para o ImportNfeUseCase
  findByCode(code: string): Promise<Product | null>;
  updateStock(id: string, quantity: number): Promise<void>;
}
