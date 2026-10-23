import { Product } from "../entities/Product";
import { ICrudRepository } from "@shared/domain/repositories/CrudRepository";

export interface ProductRepository extends ICrudRepository<Product> {
  findByCode(code: string): Promise<Product | null>;
  /**
   * Trava a linha do produto (`SELECT … FOR UPDATE`) até o fim da transação.
   * Retorna false se o produto não existe.
   */
  lockById(id: string): Promise<boolean>;
}
