// infrastructure/prisma/queries/PrismaProductQuery.ts

import { ProductReadRepository } from "@catalog/application/contracts/ProductReadRepository";
import { ProductListDTO } from "@catalog/application/dto/ProductListDTO";
import { prisma } from "@shared/prisma";

interface FindManyProductsParams {
  page: number;
  limit: number;
}
interface FindManyProductsResult {
  data: ProductListDTO[];
  total: number;
}
export class PrismaProductReadRepository implements ProductReadRepository {
  async list({
    limit,
    page,
  }: FindManyProductsParams): Promise<FindManyProductsResult> {
    const skip = (page - 1) * limit;

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        skip,
        take: limit,
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
      }),

      prisma.product.count(),
    ]);

    return {
      data: products.map((product) => ({
        id: product.id,

        name: product.name,
        code: product.code,

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
      })),
      total,
    };
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
