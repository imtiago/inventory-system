import { ICrudRepository } from "@shared/domain/repositories/CrudRepository";
import { Category } from "../entities/Category";

export interface CategoryRepository extends ICrudRepository<Category> {
  /** Busca pelo nome sem diferença de caixa (mesma regra do índice único lower(name)). */
  findByName(name: string): Promise<Category | null>;

  /** SELECT … FOR UPDATE; exige transação ativa. false se não existir. */
  lockById(id: string): Promise<boolean>;

  countProducts(id: string): Promise<number>;
}
