// infrastructure/prisma/queries/PrismaProductQuery.ts

import { ProductReadRepository } from "@catalog/application/contracts/ProductReadRepository";
import { ProductListDTO } from "@catalog/application/dto/ProductListDTO";
import { PaginatedResult } from "@shared/application/dtos/PaginatedResult";
import { PaginationRequest } from "@shared/application/dtos/PaginationRequest";
import { buildPaginatedResult } from "@shared/infrastructure/database/buildPaginatedResult";
import { buildPagination } from "@shared/infrastructure/database/buildPagination";
import { prisma } from "@shared/prisma";

export class PrismaProductReadRepository implements ProductReadRepository {
  async list(
    pagination: PaginationRequest,
  ): Promise<PaginatedResult<ProductListDTO>> {
    const paginationOptions = buildPagination(pagination);

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        ...paginationOptions,

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

    const dt = products.map((product) => ({
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
    }));
    return buildPaginatedResult(dt, total, pagination);
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
