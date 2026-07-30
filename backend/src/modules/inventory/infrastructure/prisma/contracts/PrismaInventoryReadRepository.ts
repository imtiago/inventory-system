import { InventoryReadRepository } from "@inventory/application/contracts/InventoryReadRepository";
import { InventoryDTO } from "@inventory/application/dto/InventoryDTO";
import { InventoryReadMapper } from "@inventory/application/mappers/InventoryReadMapper";
import { PaginatedResult } from "@shared/application/dtos/PaginatedResult";
import { PaginationRequest } from "@shared/application/dtos/PaginationRequest";
import { buildPaginatedResult } from "@shared/infrastructure/database/buildPaginatedResult";
import { buildPagination } from "@shared/infrastructure/database/buildPagination";
import { prisma } from "@shared/prisma";

export class PrismaInventoryReadRepository implements InventoryReadRepository {
  async list(
    pagination: PaginationRequest,
  ): Promise<PaginatedResult<InventoryDTO>> {
    const paginationOptions = buildPagination(pagination);

    const [data, total] = await Promise.all([
      prisma.inventory.findMany({
        ...paginationOptions,
        orderBy: {
          createdAt: "asc",
        },
        include: {
          productVariant: true,
        },
      }),

      prisma.inventory.count(),
    ]);

    const dt = data.map((d) => InventoryReadMapper.toDTO(d));
    return buildPaginatedResult(dt, total, pagination);
  }

  async getById(id: string): Promise<InventoryDTO | null> {
    const data = await prisma.inventory.findUnique({
      where: { id },
    });

    if (!data) return null;

    return InventoryReadMapper.toDTO(data);
  }

  async getByVariantId(id: string): Promise<InventoryDTO | null> {
    const data = await prisma.inventory.findUnique({
      where: {
        productVariantId: id,
      },
    });

    if (!data) return null;

    return InventoryReadMapper.toDTO(data);
  }
}
