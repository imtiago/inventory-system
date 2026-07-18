import { Prisma, Product as PrismaProduct } from "@prisma/client";
import { Product } from "../../domain/entities/Product";

export class ProductMapper {
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

  static toCreatePersistence(
    product: Product,
  ): Prisma.ProductUncheckedCreateInput {
    return {
      id: product.id,
      name: product.name,
      description: product.description,
      brandId: product.brandId,
      categoryId: product.categoryId,
      createdAt: product.createdAt,
    };
  }

  static toUpdatePersistence(
    product: Product,
  ): Prisma.ProductUncheckedUpdateInput {
    return {
      name: product.name,
      description: product.description,
      brandId: product.brandId,
      categoryId: product.categoryId,
    };
  }
}
