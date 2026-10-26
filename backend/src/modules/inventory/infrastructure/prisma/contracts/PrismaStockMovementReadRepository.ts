import { readTogether } from "@shared/infrastructure/database/readTogether";
import {
  IList,
  StockMovementReadRepository,
} from "@inventory/application/contracts/StockMovementReadRepository";
import { StockMovementReadMapper } from "@inventory/application/mappers/StockMovementReadMapper";
import { Prisma } from "@prisma/client";
import { PaginationRequest } from "@shared/application/dtos/PaginationRequest";
import { buildPaginatedResult } from "@shared/infrastructure/database/buildPaginatedResult";
import { buildPagination } from "@shared/infrastructure/database/buildPagination";
import { getDb } from "@shared/infrastructure/prisma/transactionContext";

export class PrismaStockMovementReadRepository implements StockMovementReadRepository {
  async list(params: IList) {
    const paginationOptions = buildPagination(params.pagination);
    const where: Prisma.StockMovementWhereInput = {};
    if (params?.inventoryId) {
      where.inventoryId = params.inventoryId;
    }

    if (params?.productVariantId) {
      where.productVariantId = params.productVariantId;
    }

    if (params?.type) {
      where.type = params.type as Prisma.StockMovementWhereInput["type"];
    }

    if (params?.origin) {
      where.origin = params.origin as Prisma.StockMovementWhereInput["origin"];
    }
    const [data, total] = await readTogether([
      getDb().stockMovement.findMany({
        ...paginationOptions,
        where,
        orderBy: {
          createdAt: "asc",
        },
        include: {
          productVariant: true,
          inventory: true,
          user: true,
        },
      }),

      getDb().stockMovement.count({ where }),
    ]);

    const dt = data.map((d) => StockMovementReadMapper.toDTO(d));
    return buildPaginatedResult(dt, total, params.pagination);
  }

  async getById(id: string) {
    const data = await getDb().stockMovement.findUnique({
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
    const data = await getDb().stockMovement.findFirst({
      where: {
        productVariantId: id,
      },
      orderBy: { createdAt: "desc" },
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
