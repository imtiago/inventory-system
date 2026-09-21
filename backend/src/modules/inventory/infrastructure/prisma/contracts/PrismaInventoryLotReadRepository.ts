import {
  IGetByVariantId,
  InventoryLotReadRepository,
} from "@inventory/application/contracts/InventoryLotReadRepository";
import { InventoryLotDTO } from "@inventory/application/dto/InventoryLotDTO";
import { InventoryLotReadMapper } from "@inventory/application/mappers/InventoryLotReadMapper";
import { PaginatedResult } from "@shared/application/dtos/PaginatedResult";
import { buildPaginatedResult } from "@shared/infrastructure/database/buildPaginatedResult";
import { buildPagination } from "@shared/infrastructure/database/buildPagination";
import { prisma } from "@shared/prisma";

export class PrismaInventoryLotReadRepository implements InventoryLotReadRepository {
  async getByVariantId(
    pagination,
    params,
  ): Promise<PaginatedResult<InventoryLotDTO>> {
    const paginationOptions = buildPagination(pagination);

    const [data, total] = await Promise.all([
      prisma.inventoryLot.findMany({
        ...paginationOptions,
        where: {
          productVariantId: params.producVariantId,
        },
        orderBy: {
          createdAt: "asc",
        },
      }),

      prisma.inventoryLot.count({
        where: {
          productVariantId: params.producVariantId,
        },
      }),
    ]);

    const dt = data.map((d) => InventoryLotReadMapper.toDTO(d));
    return buildPaginatedResult(dt, total, pagination);
  }
  async getById(id: string): Promise<InventoryLotDTO | null> {
    const data = await prisma.inventoryLot.findUnique({
      where: { id },
      // include: {
      //   productVariant: true,
      // },
    });

    if (!data) return null;

    return InventoryLotReadMapper.toDTO(data);
  }
}
