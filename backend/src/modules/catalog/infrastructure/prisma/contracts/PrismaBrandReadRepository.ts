// infrastructure/prisma/queries/PrismaProductQuery.ts

import { BrandReadRepository } from "@catalog/application/contracts/BrandReadRepository";
import { BrandListDTO } from "@catalog/application/dto/BrandListDTO";
import { PaginatedResult } from "@shared/application/dtos/PaginatedResult";
import { PaginationRequest } from "@shared/application/dtos/PaginationRequest";
import { buildPaginatedResult } from "@shared/infrastructure/database/buildPaginatedResult";
import { buildPagination } from "@shared/infrastructure/database/buildPagination";
import { prisma } from "@shared/prisma";

export class PrismaBrandReadRepository implements BrandReadRepository {
  async list(
    pagination: PaginationRequest,
  ): Promise<PaginatedResult<BrandListDTO>> {
    const paginationOptions = buildPagination(pagination);

    const [brands, total] = await prisma.$transaction([
      prisma.brand.findMany({
        ...paginationOptions,
        orderBy: {
          name: "asc",
        },
      }),
      prisma.brand.count(),
    ]);

    const dt = brands.map((brand) => ({
      id: brand.id,

      name: brand.name,
    }));
    return buildPaginatedResult(dt, total, pagination);
  }

  async getById(id: string): Promise<BrandListDTO | null> {
    const brand = await prisma.brand.findUnique({
      where: { id },
    });

    if (!brand) return null;

    return {
      id: brand.id,

      name: brand.name,
    };
  }
}
