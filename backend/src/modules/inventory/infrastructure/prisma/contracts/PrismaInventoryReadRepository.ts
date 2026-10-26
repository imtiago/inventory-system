import { readTogether } from "@shared/infrastructure/database/readTogether";
import { Prisma } from "@prisma/client";
import { InventoryReadRepository } from "@inventory/application/contracts/InventoryReadRepository";
import { InventoryWithExtendsDTO } from "@inventory/application/dto/InventoryDTO";
import { InventoryBalanceDTO } from "@inventory/application/dto/InventoryBalanceDTO";
import { InventoryReadMapper } from "@inventory/application/mappers/InventoryReadMapper";
import { PaginatedResult } from "@shared/application/dtos/PaginatedResult";
import { PaginationRequest } from "@shared/application/dtos/PaginationRequest";
import { buildPaginatedResult } from "@shared/infrastructure/database/buildPaginatedResult";
import { buildPagination } from "@shared/infrastructure/database/buildPagination";
import { businessTodayAsUtcDate } from "@shared/domain/businessDate";
import { getDb } from "@shared/infrastructure/prisma/transactionContext";

/** Quantidade em lotes vencidos por variante (validade anterior a hoje de negócio). */
async function expiredByVariantId(variantIds: string[]): Promise<Map<string, number>> {
  if (variantIds.length === 0) return new Map();
  const rows = await getDb().inventoryLot.groupBy({
    by: ["productVariantId"],
    where: {
      productVariantId: { in: variantIds },
      remainingQuantity: { gt: 0 },
      expirationDate: { lt: businessTodayAsUtcDate() },
    },
    _sum: { remainingQuantity: true },
  });
  return new Map(rows.map((r) => [r.productVariantId, r._sum.remainingQuantity ?? 0]));
}

export class PrismaInventoryReadRepository implements InventoryReadRepository {
  async list(
    pagination: PaginationRequest,
  ): Promise<PaginatedResult<InventoryWithExtendsDTO>> {
    const paginationOptions = buildPagination(pagination);

    const [data, total] = await readTogether([
      getDb().inventory.findMany({
        ...paginationOptions,
        orderBy: {
          createdAt: "asc",
        },
        include: {
          productVariant: true,
        },
      }),

      getDb().inventory.count(),
    ]);

    const expired = await expiredByVariantId(data.map((d) => d.productVariantId));
    const dt = data.map((d) => InventoryReadMapper.toDTO(d, expired.get(d.productVariantId) ?? 0));
    return buildPaginatedResult(dt, total, pagination);
  }

  async getById(id: string): Promise<InventoryWithExtendsDTO | null> {
    const data = await getDb().inventory.findUnique({
      where: { id },
      include: {
        productVariant: true,
      },
    });

    if (!data) return null;

    const expired = await expiredByVariantId([data.productVariantId]);
    return InventoryReadMapper.toDTO(data, expired.get(data.productVariantId) ?? 0);
  }

  async getByVariantId(id: string): Promise<InventoryWithExtendsDTO | null> {
    const data = await getDb().inventory.findUnique({
      where: {
        productVariantId: id,
      },
      include: {
        productVariant: true,
      },
    });

    if (!data) return null;

    const expired = await expiredByVariantId([data.productVariantId]);
    return InventoryReadMapper.toDTO(data, expired.get(data.productVariantId) ?? 0);
  }

  async listBalancesByVariantIds(ids: string[]): Promise<InventoryBalanceDTO[]> {
    const rows = await getDb().inventory.findMany({
      where: { productVariantId: { in: ids } },
      select: { productVariantId: true, quantity: true, reservedQuantity: true },
    });

    const expired = await expiredByVariantId(rows.map((row) => row.productVariantId));
    return rows.map((row) => ({
      productVariantId: row.productVariantId,
      quantity: row.quantity,
      reserved: row.reservedQuantity,
      available: row.quantity - row.reservedQuantity,
      expired: expired.get(row.productVariantId) ?? 0,
    }));
  }

  /** Totais calculados no banco (uma consulta), sem carregar os inventários em memória. */
  async getDashboard() {
    const [row] = await getDb().$queryRaw<
      {
        totalProducts: bigint;
        totalQuantity: bigint;
        totalReserved: bigint;
        lowStock: bigint;
        outOfStock: bigint;
        totalStockValue: Prisma.Decimal;
      }[]
    >`
      SELECT
        COUNT(*) AS "totalProducts",
        COALESCE(SUM("quantity"), 0) AS "totalQuantity",
        COALESCE(SUM("reservedQuantity"), 0) AS "totalReserved",
        COUNT(*) FILTER (
          WHERE "quantity" - "reservedQuantity" > 0 AND "quantity" - "reservedQuantity" <= "minimumStock"
        ) AS "lowStock",
        COUNT(*) FILTER (WHERE "quantity" - "reservedQuantity" <= 0) AS "outOfStock",
        COALESCE(ROUND(SUM("quantity" * "averageCost"), 2), 0) AS "totalStockValue"
      FROM "Inventory"`;

    const totalQuantity = Number(row.totalQuantity);
    const totalReserved = Number(row.totalReserved);
    return {
      totalProducts: Number(row.totalProducts),
      totalQuantity,
      totalReserved,
      totalAvailable: totalQuantity - totalReserved,
      lowStock: Number(row.lowStock),
      outOfStock: Number(row.outOfStock),
      totalStockValue: Number(row.totalStockValue),
    };
  }
}
