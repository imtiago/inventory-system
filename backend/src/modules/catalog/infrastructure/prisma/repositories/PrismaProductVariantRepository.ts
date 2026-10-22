import { ProductVariantRepository } from "@catalog/domain/repositories/ProductVariantRepository";
import { ProductVariantMapper } from "../mappers/ProductVariantMapper";
import { getDb } from "@shared/infrastructure/prisma/transactionContext";
import { ProductVariant } from "@catalog/domain/entities/ProductVariant";

export class PrismaProductVariantRepository implements ProductVariantRepository {
  async create(variant: ProductVariant): Promise<ProductVariant> {
    const created = await getDb().productVariant.create({
      data: ProductVariantMapper.toCreatePersistence(variant),
    });

    return ProductVariantMapper.toDomain(created);
  }

  async update(variant: ProductVariant): Promise<ProductVariant> {
    const updated = await getDb().productVariant.update({
      where: {
        id: variant.id,
      },
      data: ProductVariantMapper.toUpdatePersistence(variant),
    });

    return ProductVariantMapper.toDomain(updated);
  }

  async findById(id: string): Promise<ProductVariant | null> {
    const variant = await getDb().productVariant.findUnique({
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
    const variants = await getDb().productVariant.findMany({
      where: {
        productId,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    return variants.map(ProductVariantMapper.toDomain);
  }

  async count(): Promise<number> {
    return getDb().productVariant.count();
  }

  async delete(id: string): Promise<void> {
    await getDb().productVariant.delete({
      where: {
        id,
      },
    });
  }

  async findByBarcode(barcode: string): Promise<ProductVariant | null> {
    const variant = await getDb().productVariant.findFirst({
      where: {
        barcode,
      },
    });

    if (!variant) {
      return null;
    }

    return ProductVariantMapper.toDomain(variant);
  }

  async findByCode(code: string): Promise<ProductVariant | null> {
    const variant = await getDb().productVariant.findUnique({
      where: {
        code,
      },
    });

    if (!variant) {
      return null;
    }

    return ProductVariantMapper.toDomain(variant);
  }
}
