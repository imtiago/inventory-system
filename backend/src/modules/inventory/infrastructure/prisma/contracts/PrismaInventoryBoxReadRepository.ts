import { InventoryBoxReadRepository } from "@inventory/application/contracts/InventoryBoxReadRepository";
import { InventoryBoxReadMapper } from "@inventory/application/mappers/InventoryBoxReadMapper";
import { InventoryReadMapper } from "@inventory/application/mappers/InventoryReadMapper";
import { PaginatedResult } from "@shared/application/dtos/PaginatedResult";
import { PaginationRequest } from "@shared/application/dtos/PaginationRequest";
import { buildPaginatedResult } from "@shared/infrastructure/database/buildPaginatedResult";
import { buildPagination } from "@shared/infrastructure/database/buildPagination";
import { getDb } from "@shared/infrastructure/prisma/transactionContext";
interface InventoryBoxParams {
  batchNumber: string;
  productVariantId: string;
}
export class PrismaInventoryBoxReadRepository implements InventoryBoxReadRepository {
  async getById(id: string) {
    const data = await getDb().inventoryBox.findUnique({
      where: { id },
      include: {
        stocks: true,
      },
    });

    if (!data) return null;

    return InventoryBoxReadMapper.toDTO(data);
  }
  async getByCode(code: string) {
    const data = await getDb().inventoryBox.findUnique({
      where: { code },
      include: {
        stocks: {
          include: {
            inventoryLot: true,
          },
        },
      },
    });
    if (!data) return null;

    return InventoryBoxReadMapper.toDTOWithExtends(data);
  }
  async getByLotAndProductVariantId(
    pagination: PaginationRequest,
    params: InventoryBoxParams,
  ) {
    const paginationOptions = buildPagination(pagination);
    const { batchNumber, productVariantId } = params;

    const where = {
      stocks: {
        some: {
          inventoryLot: {
            batchNumber,
            productVariantId,
          },
        },
      },
    };

    const [data, total] = await Promise.all([
      getDb().inventoryBox.findMany({
        ...paginationOptions,
        orderBy: {
          createdAt: "asc",
        },
        where,
        include: {
          stocks: {
            where: {
              inventoryLot: {
                batchNumber,
                productVariantId,
              },
            },
            include: {
              inventoryLot: {
                include: {
                  productVariant: true,
                },
              },
            },
          },
        },
      }),

      getDb().inventoryBox.count({
        where,
      }),
    ]);

    const dt = data.map((d) => InventoryBoxReadMapper.toDTOWithExtends(d));
    return buildPaginatedResult(dt, total, pagination);
  }
  // async list(
  //   pagination: PaginationRequest,
  // ): Promise<PaginatedResult<InventoryDTO>> {
  //   const paginationOptions = buildPagination(pagination);

  //   const [data, total] = await Promise.all([
  //     getDb().inventory.findMany({
  //       ...paginationOptions,
  //       orderBy: {
  //         createdAt: "asc",
  //       },
  //       include: {
  //         productVariant: true,
  //       },
  //     }),

  //     getDb().inventory.count(),
  //   ]);

  //   const dt = data.map((d) => InventoryReadMapper.toDTO(d));
  //   return buildPaginatedResult(dt, total, pagination);
  // }

  // async getByVariantId(id: string): Promise<InventoryDTO | null> {
  //   const data = await getDb().inventory.findUnique({
  //     where: {
  //       productVariantId: id,
  //     },
  //     include: {
  //       productVariant: true,
  //     },
  //   });

  //   if (!data) return null;

  //   return InventoryReadMapper.toDTO(data);
  // }

  // async getDashboard() {
  //   const inventories = await getDb().inventory.findMany({
  //     select: {
  //       quantity: true,
  //       reservedQuantity: true,
  //       minimumStock: true,
  //       averageCost: true,
  //     },
  //   });

  //   let totalQuantity = 0;
  //   let totalReserved = 0;
  //   let lowStock = 0;
  //   let outOfStock = 0;
  //   let totalStockValue = 0;

  //   for (const inventory of inventories) {
  //     totalQuantity += inventory.quantity;

  //     totalReserved += inventory.reservedQuantity;

  //     const available = inventory.quantity - inventory.reservedQuantity;

  //     if (available <= 0) {
  //       outOfStock++;
  //     } else if (available <= inventory.minimumStock) {
  //       lowStock++;
  //     }

  //     totalStockValue += inventory.quantity * Number(inventory.averageCost);
  //   }

  //   return {
  //     totalProducts: inventories.length,

  //     totalQuantity,

  //     totalReserved,

  //     totalAvailable: totalQuantity - totalReserved,

  //     lowStock,

  //     outOfStock,

  //     totalStockValue,
  //   };
  // }
}
