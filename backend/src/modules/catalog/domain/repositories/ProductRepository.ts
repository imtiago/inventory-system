import { Product } from "../entities/Product";
import { ICrudRepository } from "@shared/domain/repositories/CrudRepository";

export type ProductUpdatableField = "name" | "description" | "brandId" | "categoryId";

export interface ProductRepository extends ICrudRepository<Product> {
  /** Grava só os campos indicados (não sobrescreve os demais com valores lidos antes). */
  updateFields(product: Product, fields: readonly ProductUpdatableField[]): Promise<Product>;
  findByCode(code: string): Promise<Product | null>;
  /**
   * Trava a linha do produto (`SELECT … FOR UPDATE`) até o fim da transação.
   * Retorna false se o produto não existe.
   */
  lockById(id: string): Promise<boolean>;
}
