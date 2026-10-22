import {
  IGetByVariantId,
  InventoryLotReadRepository,
} from "@inventory/application/contracts/InventoryLotReadRepository";
import { InventoryLotDTO } from "@inventory/application/dto/InventoryLotDTO";
import { InventoryLotReadMapper } from "@inventory/application/mappers/InventoryLotReadMapper";
import { PaginatedResult } from "@shared/application/dtos/PaginatedResult";
import { PaginationRequest } from "@shared/application/dtos/PaginationRequest";
import { buildPaginatedResult } from "@shared/infrastructure/database/buildPaginatedResult";
import { buildPagination } from "@shared/infrastructure/database/buildPagination";
import { getDb } from "@shared/infrastructure/prisma/transactionContext";

/** Quantidades em caixas, usadas para `allocatedQuantity`. */
export const lotBoxStocksInclude = {
  boxStocks: { select: { quantity: true } },
} as const;

export class PrismaInventoryLotReadRepository implements InventoryLotReadRepository {
  async getByVariantId(
    pagination: PaginationRequest,
    params: IGetByVariantId,
  ): Promise<PaginatedResult<InventoryLotDTO>> {
    const paginationOptions = buildPagination(pagination);
    const where = { productVariantId: params.productVariantId };

    const [data, total] = await Promise.all([
      getDb().inventoryLot.findMany({
        ...paginationOptions,
        where,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        include: lotBoxStocksInclude,
      }),

      getDb().inventoryLot.count({ where }),
    ]);

    const dt = data.map((d) => InventoryLotReadMapper.toDTO(d));
    return buildPaginatedResult(dt, total, pagination);
  }

  async getById(id: string): Promise<InventoryLotDTO | null> {
    const data = await getDb().inventoryLot.findUnique({
      where: { id },
      include: lotBoxStocksInclude,
    });

    if (!data) return null;

    return InventoryLotReadMapper.toDTO(data);
  }
}
