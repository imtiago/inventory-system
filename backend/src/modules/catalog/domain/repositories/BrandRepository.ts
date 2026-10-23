import { ICrudRepository } from "@shared/domain/repositories/CrudRepository";
import { Brand } from "../entities/Brand";

export interface BrandRepository extends ICrudRepository<Brand> {
  /** Busca pelo nome sem diferença de caixa (mesma regra do índice único lower(name)). */
  findByName(name: string): Promise<Brand | null>;

  /** SELECT … FOR UPDATE; exige transação ativa. false se não existir. */
  lockById(id: string): Promise<boolean>;

  countProducts(id: string): Promise<number>;
}
