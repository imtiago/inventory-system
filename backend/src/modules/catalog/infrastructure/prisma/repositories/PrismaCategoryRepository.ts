import { CategoryRepository } from "@catalog/domain/repositories/CategoryRepository";
import { CategoryMapper } from "../mappers/CategoryMapper";
import { Category } from "@prisma/client";
import { getDb } from "@shared/infrastructure/prisma/transactionContext";

export class PrismaCategoryRepository implements CategoryRepository {
  async list(): Promise<Category[]> {
    const categories = await getDb().category.findMany();

    return categories.map(CategoryMapper.toDomain);
  }

  async create(category: Category): Promise<Category> {
    const created = await getDb().category.create({
      data: CategoryMapper.toCreatePersistence(category),
    });

    return CategoryMapper.toDomain(created);
  }

  async findById(id: string): Promise<Category | null> {
    const category = await getDb().category.findUnique({
      where: { id },
    });

    if (!category) {
      return null;
    }

    return CategoryMapper.toDomain(category);
  }
}
