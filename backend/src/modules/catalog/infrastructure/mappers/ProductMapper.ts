// src/modules/catalog/application/mappers/ProductMapper.ts
import { Product } from "../../domain/entities/Product";
import { Product as PrismaProduct } from "@prisma/client"; // entidade do banco

export class ProductMapper {
  // Mapeia entidade do banco para entidade do domínio
  static toDomain(prisma: PrismaProduct): Product {
    return new Product({
      id: prisma.id,
      name: prisma.name,
      description: prisma.description,
      brandId: prisma.brandId,
      categoryId: prisma.categoryId,
      createdAt: prisma.createdAt,
    });
  }

  // Mapeia entidade do domínio para formato compatível com banco (prisma)
  static toCreatePersistence(product: Product): PrismaProduct {
    return {
      id: product.id,
      name: product.name,
      description: product.description,
      brandId: product.brandId,
      categoryId: product.categoryId,
      createdAt: product.createdAt,
    };
  }

  // Mapeia entidade do domínio para formato compatível com banco (prisma)
  static toUpdatePersistence(product: Product): PrismaProduct {
    return {
      id: product.id,
      name: product.name,
      description: product.description,
      brandId: product.brandId,
      categoryId: product.categoryId,
      createdAt: product.createdAt,
    };
  }
}
