// src/modules/catalog/application/useCases/CreateCategory.ts
import { CategoryRepository } from "../../domain/repositories/CategoryRepository";
import { Category } from "../../domain/entities/Category";

export class CreateCategory {
  constructor(private repository: CategoryRepository) {}

  async execute(name: string): Promise<Category> {
    const category = new Category({
      id: crypto.randomUUID(),
      name,
      createdAt: new Date(),
    });
    return this.repository.create(category);
  }
}
