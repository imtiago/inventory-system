import { Category } from "@catalog/domain/entities/Category";
import { Category as PrismaCategory, Prisma } from "@prisma/client";

export class CategoryMapper {
  // Banco -> Domínio
  static toDomain(prisma: PrismaCategory): Category {
    return new Category({
      id: prisma.id,
      name: prisma.name,
      createdAt: prisma.createdAt,
    });
  }

  // Domínio -> Banco (Create)
  static toCreatePersistence(
    category: Category,
  ): Prisma.CategoryUncheckedCreateInput {
    return {
      id: category.id,
      name: category.name,
      createdAt: category.createdAt,
    };
  }

  // Domínio -> Banco (Update)
  static toUpdatePersistence(
    category: Category,
  ): Prisma.CategoryUncheckedUpdateInput {
    return {
      name: category.name,
    };
  }
}
