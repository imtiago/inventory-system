// src/modules/catalog/domain/repositories/CategoryRepository.ts
import { Category } from "../entities/Category";

export interface CategoryRepository {
  create(category: Category): Promise<Category>;
  list(page: number, limit: number): Promise<Category[]>;
  findById(id: string): Promise<Category | null>;
}
