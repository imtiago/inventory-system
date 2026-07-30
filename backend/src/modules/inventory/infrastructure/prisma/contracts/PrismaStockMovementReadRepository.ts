import { StockMovementReadRepository } from "@inventory/application/contracts/StockMovementReadRepository";
import { StockMovementReadMapper } from "@inventory/application/mappers/StockMovementReadMapper";
import { PaginationRequest } from "@shared/application/dtos/PaginationRequest";
import { buildPaginatedResult } from "@shared/infrastructure/database/buildPaginatedResult";
import { buildPagination } from "@shared/infrastructure/database/buildPagination";
import { prisma } from "@shared/prisma";

export class PrismaStockMovementReadRepository implements StockMovementReadRepository {
  async list(pagination: PaginationRequest) {
    const paginationOptions = buildPagination(pagination);

    const [data, total] = await Promise.all([
      prisma.stockMovement.findMany({
        ...paginationOptions,
        orderBy: {
          createdAt: "asc",
        },
        include: {
          productVariant: true,
          inventory: true,
          user: true,
        },
      }),

      prisma.stockMovement.count(),
    ]);

    const dt = data.map((d) => StockMovementReadMapper.toDTO(d));
    return buildPaginatedResult(dt, total, pagination);
  }

  async getById(id: string) {
    const data = await prisma.stockMovement.findUnique({
      where: { id },
      include: {
        productVariant: true,
        inventory: true,
        user: true,
      },
    });

    if (!data) return null;

    return StockMovementReadMapper.toDTO(data);
  }

  async getByVariantId(id: string) {
    const data = await prisma.stockMovement.findUnique({
      where: {
        productVariantId: id,
      },
      include: {
        productVariant: true,
        inventory: true,
        user: true,
      },
    });

    if (!data) return null;

    return StockMovementReadMapper.toDTO(data);
  }
}
