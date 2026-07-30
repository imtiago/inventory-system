import { SaleReadRepository } from "@sales/application/contracts/SaleReadRepository";
import { SaleDetailsDTO } from "@sales/application/dto/SaleDTO";
import { SaleReadMapper } from "@sales/application/mappers/SaleReadMapper";
import { PaginatedResult } from "@shared/application/dtos/PaginatedResult";
import { PaginationRequest } from "@shared/application/dtos/PaginationRequest";
import { buildPaginatedResult } from "@shared/infrastructure/database/buildPaginatedResult";
import { buildPagination } from "@shared/infrastructure/database/buildPagination";
import { prisma } from "@shared/prisma";

export class PrismaSaleReadRepository implements SaleReadRepository {
  async list(
    pagination: PaginationRequest,
  ): Promise<PaginatedResult<SaleDetailsDTO>> {
    const paginationOptions = buildPagination(pagination);
    const [sales, total] = await prisma.$transaction([
      prisma.sale.findMany({
        ...paginationOptions,

        include: {
          customer: true,
          items: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      }),
      prisma.sale.count(),
    ]);

    const dt = sales.map((sale) => SaleReadMapper.toDTO(sale));

    return buildPaginatedResult(dt, total, pagination);
  }

  async getById(id: string): Promise<SaleDetailsDTO | null> {
    const sale = await prisma.sale.findUnique({
      where: { id },
      include: {
        customer: true,
        items: {
          include: {
            productVariant: true,
          },
        },
      },
    });

    if (!sale) {
      return null;
    }

    return SaleReadMapper.toDTO(sale);
  }
}
