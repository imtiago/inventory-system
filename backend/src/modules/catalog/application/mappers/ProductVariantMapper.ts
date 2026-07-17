// src/modules/catalog/application/mappers/ProductVariantMapper.ts

import { ProductVariant } from "../../domain/entities/ProductVariant";
import { ProductVariant as PrismaProductVariant, Prisma } from "@prisma/client";

export class ProductVariantMapper {
  static toDomain(prisma: PrismaProductVariant): ProductVariant {
    return new ProductVariant({
      id: prisma.id,
      productId: prisma.productId,
      code: prisma.code,
      name: prisma.name,
      barcode: prisma.barcode,
      createdAt: prisma.createdAt,
    });
  }

  static toCreatePersistence(
    variant: ProductVariant,
  ): Prisma.ProductVariantUncheckedCreateInput {
    return {
      id: variant.id,
      productId: variant.productId,
      code: variant.code,
      name: variant.name,
      barcode: variant.barcode,
      createdAt: variant.createdAt,
    };
  }

  static toUpdatePersistence(
    variant: ProductVariant,
  ): Prisma.ProductVariantUncheckedUpdateInput {
    return {
      productId: variant.productId,
      code: variant.code,
      name: variant.name,
      barcode: variant.barcode,
    };
  }
}
