// infrastructure/prisma/queries/PrismaProductQuery.ts

import { ProductListFilters } from "@catalog/application/contracts/ProductListFilters";
import { ProductReadRepository } from "@catalog/application/contracts/ProductReadRepository";
import { ProductListDTO } from "@catalog/application/dto/ProductListDTO";
import { ProductReadMapper } from "@catalog/application/mappers/ProductReadMapper";
import { PaginatedResult } from "@shared/application/dtos/PaginatedResult";
import { PaginationRequest } from "@shared/application/dtos/PaginationRequest";
import { buildPaginatedResult } from "@shared/infrastructure/database/buildPaginatedResult";
import { buildPagination } from "@shared/infrastructure/database/buildPagination";
import { prisma } from "@shared/prisma";

export class PrismaProductReadRepository implements ProductReadRepository {
  async list(
    pagination: PaginationRequest,
    filters?: ProductListFilters,
  ): Promise<PaginatedResult<ProductListDTO>> {
    const paginationOptions = buildPagination(pagination);
    const search = filters?.search?.trim();

    const where = search
      ? {
          OR: [
            {
              name: {
                contains: search,
                mode: "insensitive" as const,
              },
            },
            {
              code: {
                contains: search,
                mode: "insensitive" as const,
              },
            },
          ],
        }
      : {};

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        ...paginationOptions,

        where,

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

      prisma.product.count({
        where,
      }),
    ]);

    const dt = products.map((product) => ProductReadMapper.toDTO(product));
    return buildPaginatedResult(dt, total, pagination);
  }

  async getById(id: string): Promise<ProductListDTO | null> {
    const product = await prisma.product.findUnique({
      where: { id },

      include: {
        brand: true,
        category: true,
        _count: true,
      },
    });

    if (!product) return null;

    return ProductReadMapper.toDTO(product);
  }
}
