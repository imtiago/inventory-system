import {
  InventoryBoxByLotParams,
  InventoryBoxListFilters,
  InventoryBoxReadRepository,
} from "@inventory/application/contracts/InventoryBoxReadRepository";
import {
  InventoryBoxDTO,
  InventoryBoxWithExtendsDTO,
} from "@inventory/application/dto/InventoryBoxDTO";
import { InventoryBoxReadMapper } from "@inventory/application/mappers/InventoryBoxReadMapper";
import { Prisma } from "@prisma/client";
import { PaginatedResult } from "@shared/application/dtos/PaginatedResult";
import { PaginationRequest } from "@shared/application/dtos/PaginationRequest";
import { buildPaginatedResult } from "@shared/infrastructure/database/buildPaginatedResult";
import { buildPagination } from "@shared/infrastructure/database/buildPagination";
import { containsLiteral } from "@shared/infrastructure/database/literalSearch";
import { getDb } from "@shared/infrastructure/prisma/transactionContext";
import { lotBoxStocksInclude } from "./PrismaInventoryLotReadRepository";

const stockLotInclude = {
  inventoryLot: {
    include: { productVariant: true, ...lotBoxStocksInclude },
  },
} as const;

export class PrismaInventoryBoxReadRepository implements InventoryBoxReadRepository {
  async getById(id: string): Promise<InventoryBoxDTO | null> {
    const data = await getDb().inventoryBox.findUnique({ where: { id } });

    if (!data) return null;

    return InventoryBoxReadMapper.toDTO(data);
  }

  async getByCode(code: string): Promise<InventoryBoxWithExtendsDTO | null> {
    const data = await getDb().inventoryBox.findUnique({
      where: { code },
      include: { stocks: { include: stockLotInclude } },
    });
    if (!data) return null;

    return InventoryBoxReadMapper.toDTOWithExtends(data);
  }

  async getByLotAndProductVariantId(
    pagination: PaginationRequest,
    params: InventoryBoxByLotParams,
  ): Promise<PaginatedResult<InventoryBoxWithExtendsDTO>> {
    const paginationOptions = buildPagination(pagination);
    const { batchNumber, productVariantId } = params;
    const lotWhere = { inventoryLot: { batchNumber, productVariantId } };
    const where = { stocks: { some: lotWhere } };

    const [data, total] = await Promise.all([
      getDb().inventoryBox.findMany({
        ...paginationOptions,
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        where,
        include: {
          stocks: { where: lotWhere, include: stockLotInclude },
        },
      }),

      getDb().inventoryBox.count({ where }),
    ]);

    const dt = data.map((d) => InventoryBoxReadMapper.toDTOWithExtends(d));
    return buildPaginatedResult(dt, total, pagination);
  }

  async list(
    pagination: PaginationRequest,
    filters: InventoryBoxListFilters = {},
  ): Promise<PaginatedResult<InventoryBoxDTO>> {
    const paginationOptions = buildPagination(pagination);
    const where: Prisma.InventoryBoxWhereInput = filters.search
      ? { code: containsLiteral(filters.search) }
      : {};

    const [data, total] = await Promise.all([
      getDb().inventoryBox.findMany({
        ...paginationOptions,
        where,
        orderBy: [{ createdAt: "desc" }, { code: "asc" }],
      }),
      getDb().inventoryBox.count({ where }),
    ]);

    const dt = data.map((d) => InventoryBoxReadMapper.toDTO(d));
    return buildPaginatedResult(dt, total, pagination);
  }
}
