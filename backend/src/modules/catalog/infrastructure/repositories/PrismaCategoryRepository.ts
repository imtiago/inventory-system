import { prisma } from "../../../../shared/prisma";
import { Category } from "../../domain/entities/Category";
import { CategoryRepository } from "../../domain/repositories/CategoryRepository";
import { CategoryMapper } from "../mappers/CategoryMapper";

export class PrismaCategoryRepository implements CategoryRepository {
  async list(): Promise<Category[]> {
    const categories = await prisma.category.findMany();

    return categories.map(CategoryMapper.toDomain);
  }

  async create(category: Category): Promise<Category> {
    const created = await prisma.category.create({
      data: CategoryMapper.toCreatePersistence(category),
    });

    return CategoryMapper.toDomain(created);
  }

  async findById(id: string): Promise<Category | null> {
    const category = await prisma.category.findUnique({
      where: { id },
    });

    if (!category) {
      return null;
    }

    return CategoryMapper.toDomain(category);
  }
}
