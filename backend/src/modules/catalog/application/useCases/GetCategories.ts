import { Category } from "@catalog/domain/entities/Category";
import { CategoryRepository } from "@catalog/domain/repositories/CategoryRepository";

export class GetCategories {
  constructor(private repository: CategoryRepository) {}

  async execute(page: number = 1, limit: number = 10): Promise<Category[]> {
    return this.repository.list(page, limit);
  }
}
