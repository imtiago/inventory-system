import { CategoriesReadRepository } from "@catalog/application/contracts/CategoriesReadRepository";
import { CategoriesListDTO } from "@catalog/application/dto/CategoriesListDTO";
import { prisma } from "@shared/prisma";

export class PrismaCategoriesReadRepository implements CategoriesReadRepository {
  async list(): Promise<CategoriesListDTO[]> {
    const categories = await prisma.category.findMany({
      orderBy: {
        name: "asc",
      },
    });

    return categories.map((category) => ({
      id: category.id,

      name: category.name,
    }));
  }

  async getById(id: string): Promise<CategoriesListDTO | null> {
    const category = await prisma.category.findUnique({
      where: { id },
    });

    if (!category) return null;

    return {
      id: category.id,

      name: category.name,
    };
  }
}
