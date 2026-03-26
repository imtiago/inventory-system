// src/modules/catalog/infrastructure/repositories/PrismaCategoryRepository.ts
import { prisma } from "../../../../shared/prisma";
import { Category } from "../../domain/entities/Category";

export class PrismaCategoryRepository {
  // Listar todas as categories
  async list(): Promise<Category[]> {
    const categories = await prisma.category.findMany();

    return categories.map(
      (c) =>
        new Category({
          id: c.id,
          name: c.name,
          createdAt: c.createdAt, // agora existe no banco!
        }),
    );
  }

  // Criar uma nova category
  async create(category: Category): Promise<Category> {
    const created = await prisma.category.create({
      data: {
        id: category.id,
        name: category.name,
        createdAt: category.createdAt,
      },
    });

    return new Category({
      id: created.id,
      name: created.name,
      createdAt: created.createdAt,
    });
  }

  async findById(id: string): Promise<Category | null> {
    return prisma.category.findUnique({
      where: { id },
    });
  }
}
