import { prisma } from "../../../../shared/prisma";

import { ProductVariant } from "../../domain/entities/ProductVariant";
import { ProductVariantRepository } from "../../domain/repositories/ProductVariantRepository";

import { ProductVariantMapper } from "../mappers/ProductVariantMapper";

export class PrismaProductVariantRepository implements ProductVariantRepository {
  async create(variant: ProductVariant): Promise<ProductVariant> {
    const created = await prisma.productVariant.create({
      data: ProductVariantMapper.toCreatePersistence(variant),
    });

    return ProductVariantMapper.toDomain(created);
  }

  async update(variant: ProductVariant): Promise<ProductVariant> {
    const updated = await prisma.productVariant.update({
      where: {
        id: variant.id,
      },
      data: ProductVariantMapper.toUpdatePersistence(variant),
    });

    return ProductVariantMapper.toDomain(updated);
  }

  async findById(id: string): Promise<ProductVariant | null> {
    const variant = await prisma.productVariant.findUnique({
      where: {
        id,
      },
    });

    if (!variant) {
      return null;
    }

    return ProductVariantMapper.toDomain(variant);
  }

  async findByProduct(productId: string): Promise<ProductVariant[]> {
    const variants = await prisma.productVariant.findMany({
      where: {
        productId,
      },
    });

    return variants.map(ProductVariantMapper.toDomain);
  }

  async count(): Promise<number> {
    return prisma.productVariant.count();
  }

  async delete(id: string): Promise<void> {
    await prisma.productVariant.delete({
      where: {
        id,
      },
    });
  }
}
