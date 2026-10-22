// src/modules/catalog/domain/repositories/CategoryRepository.ts
import { ICrudRepository } from "@shared/domain/repositories/CrudRepository";
import { Category } from "../entities/Category";

export interface CategoryRepository extends ICrudRepository<Category> {
  // list(page: number, limit: number): Promise<Category[]>;
}
