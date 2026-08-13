import { InventoryBoxReadRepository } from "@inventory/application/contracts/InventoryBoxReadRepository";
import { InventoryBoxReadMapper } from "@inventory/application/mappers/InventoryBoxReadMapper";
import { InventoryReadMapper } from "@inventory/application/mappers/InventoryReadMapper";
import { PaginatedResult } from "@shared/application/dtos/PaginatedResult";
import { PaginationRequest } from "@shared/application/dtos/PaginationRequest";
import { buildPaginatedResult } from "@shared/infrastructure/database/buildPaginatedResult";
import { buildPagination } from "@shared/infrastructure/database/buildPagination";
import { prisma } from "@shared/prisma";

export class PrismaInventoryBoxReadRepository implements InventoryBoxReadRepository {
  async getById(id: string) {
    const data = await prisma.inventoryBox.findUnique({
      where: { id },
      include: {
        stocks: true,
      },
    });

    if (!data) return null;

    return InventoryBoxReadMapper.toDTO(data);
  }
  async getByCode(code: string) {
    const data = await prisma.inventoryBox.findUnique({
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
    batchNumber: string,
    productVariantId: string,
  ) {
    const data = await prisma.inventoryBox.findFirst({
      where: {
        stocks: {
          some: {
            inventoryLot: {
              batchNumber,
              productVariantId,
            },
          },
        },
      },
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
    });
    if (!data) return null;

    return InventoryBoxReadMapper.toDTOWithExtends(data);
  }
  // async list(
  //   pagination: PaginationRequest,
  // ): Promise<PaginatedResult<InventoryDTO>> {
  //   const paginationOptions = buildPagination(pagination);

  //   const [data, total] = await Promise.all([
  //     prisma.inventory.findMany({
  //       ...paginationOptions,
  //       orderBy: {
  //         createdAt: "asc",
  //       },
  //       include: {
  //         productVariant: true,
  //       },
  //     }),

  //     prisma.inventory.count(),
  //   ]);

  //   const dt = data.map((d) => InventoryReadMapper.toDTO(d));
  //   return buildPaginatedResult(dt, total, pagination);
  // }

  // async getByVariantId(id: string): Promise<InventoryDTO | null> {
  //   const data = await prisma.inventory.findUnique({
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
  //   const inventories = await prisma.inventory.findMany({
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
