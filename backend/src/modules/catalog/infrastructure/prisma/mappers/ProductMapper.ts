import { Product } from "@catalog/domain/entities/Product";
import { Prisma, Product as PrismaProduct } from "@prisma/client";

export class ProductMapper {
  static toDomain(prisma: PrismaProduct): Product {
    return new Product({
      id: prisma.id,
      name: prisma.name,
      code: prisma.code,

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
      code: product.code,
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
      code: product.code,

      description: product.description,
      brandId: product.brandId,
      categoryId: product.categoryId,
    };
  }
}
