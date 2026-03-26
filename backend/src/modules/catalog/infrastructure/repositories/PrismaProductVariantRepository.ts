import { prisma } from "../../../../shared/prisma";
import { ProductVariant } from "../../domain/entities/ProductVariant";
import { ProductVariantRepository } from "../../domain/repositories/ProductVariantRepository";

export class PrismaProductVariantRepository implements ProductVariantRepository {
  async create(variant: ProductVariant): Promise<ProductVariant> {
    const created = await prisma.productVariant.create({
      data: {
        name: variant.name,
        code: variant.code,
        productId: variant.productId,
      },
    });

    return created;
  }

  async findByProduct(productId: string): Promise<ProductVariant[]> {
    return prisma.productVariant.findMany({
      where: { productId },
    });
  }
  async count(): Promise<number> {
    return prisma.productVariant.count();
  }
}
