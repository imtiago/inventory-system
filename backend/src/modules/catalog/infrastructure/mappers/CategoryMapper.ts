// src/modules/catalog/application/mappers/CategoryMapper.ts

import { Category } from "../../domain/entities/Category";
import { Category as PrismaCategory } from "@prisma/client";

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
  static toCreatePersistence(category: Category): PrismaCategory {
    return {
      id: category.id,
      name: category.name,
      createdAt: category.createdAt,
    };
  }

  // Domínio -> Banco (Update)
  static toUpdatePersistence(category: Category): PrismaCategory {
    return {
      id: category.id,
      name: category.name,
      createdAt: category.createdAt,
    };
  }
}
