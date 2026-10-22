// src/modules/catalog/domain/repositories/BrandRepository.ts
import { ICrudRepository } from "@shared/domain/repositories/CrudRepository";
import { Brand } from "../entities/Brand";

export interface BrandRepository extends ICrudRepository<Brand> {
  // list(page: number, limit: number): Promise<Brand[]>;
}
