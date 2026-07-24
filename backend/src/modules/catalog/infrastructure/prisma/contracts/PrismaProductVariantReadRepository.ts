// infrastructure/prisma/queries/PrismaProductQuery.ts

import { ProductVariantReadRepository } from "@catalog/application/contracts/ProductVariantReadRepository";
import { ProductVariantDTO } from "@catalog/application/dto/ProductVariantDTO";
import { prisma } from "@shared/prisma";

export class PrismaProductVariantReadRepository implements ProductVariantReadRepository {
  async getByProductId(productId: string): Promise<ProductVariantDTO[]> {
    const productsVariant = await prisma.productVariant.findMany({
      where: {
        productId,
      },
      include: {
        product: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    return productsVariant.map((variant) => ({
      id: variant.id,
      name: variant.name,
      barcode: variant.barcode,
      code: variant.code,
      productName: variant.product.name,
      productId: variant.product.id,
      salePrice: variant.salePrice,
    }));
  }

  async list(): Promise<ProductVariantDTO[]> {
    const productsVariant = await prisma.productVariant.findMany({
      include: {
        product: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    return productsVariant.map((variant) => ({
      id: variant.id,
      name: variant.name,
      barcode: variant.barcode,
      code: variant.code,
      productName: variant.product.name,
      productId: variant.product.id,
      salePrice: variant.salePrice,
    }));
  }

  async getById(id: string): Promise<ProductVariantDTO | null> {
    const variant = await prisma.productVariant.findUnique({
      where: { id },
      include: {
        product: true,
      },
    });

    if (!variant) return null;

    return {
      id: variant.id,
      name: variant.name,
      barcode: variant.barcode,
      code: variant.code,
      productName: variant.product.name,
      productId: variant.product.id,
      salePrice: variant.salePrice,
    };
  }
}
