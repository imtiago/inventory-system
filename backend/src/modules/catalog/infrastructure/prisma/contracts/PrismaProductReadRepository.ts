// infrastructure/prisma/queries/PrismaProductQuery.ts

import { ProductReadRepository } from "@catalog/application/contracts/ProductReadRepository";
import { ProductListDTO } from "@catalog/application/dto/ProductListDTO";
import { prisma } from "@shared/prisma";

export class PrismaProductReadRepository implements ProductReadRepository {
  async list(): Promise<ProductListDTO[]> {
    const products = await prisma.product.findMany({
      include: {
        brand: true,
        category: true,
        _count: {
          select: {
            variants: true,
          },
        },
      },

      orderBy: {
        name: "asc",
      },
    });

    return products.map((product) => ({
      id: product.id,

      name: product.name,

      description: product.description,

      brand: {
        id: product.brand.id,
        name: product.brand.name,
      },

      category: {
        id: product.category.id,
        name: product.category.name,
      },

      variantsCount: product._count.variants,
    }));
  }

  async getById(id: string): Promise<ProductListDTO | null> {
    const product = await prisma.product.findUnique({
      where: { id },

      include: {
        brand: true,
        category: true,
      },
    });

    if (!product) return null;

    return {
      id: product.id,

      name: product.name,

      description: product.description,

      createdAt: product.createdAt,

      brand: {
        id: product.brand.id,
        name: product.brand.name,
      },

      category: {
        id: product.category.id,
        name: product.category.name,
      },
    };
  }
}
