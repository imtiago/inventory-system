import { InventoryBoxStock } from "@inventory/domain/entities/InventoryBoxStock";
import {
  InventoryBoxStock as PrismaInventoryBoxStock,
  Prisma,
} from "@prisma/client";

export class InventoryBoxStockMapper {
  /**
   * Banco -> Domínio
   */
  static toDomain(prisma: PrismaInventoryBoxStock): InventoryBoxStock {
    return new InventoryBoxStock({
      id: prisma.id,
      inventoryLotId: prisma.inventoryLotId,
      boxId: prisma.boxId,
      quantity: prisma.quantity,
      createdAt: prisma.createdAt,
      updatedAt: prisma.updatedAt,
    });
  }

  /**
   * Domínio -> Banco
   */
  static toCreatePersistence(
    stock: InventoryBoxStock,
  ): Prisma.InventoryBoxStockCreateInput {
    return {
      id: stock.id,
      quantity: stock.quantity,
      createdAt: stock.createdAt,
      updatedAt: stock.updatedAt,

      inventoryLot: {
        connect: {
          id: stock.inventoryLotId,
        },
      },

      box: {
        connect: {
          id: stock.boxId,
        },
      },
    };
  }

  /**
   * Domínio -> Banco - Update
   */
  static toUpdatePersistence(
    stock: InventoryBoxStock,
  ): Prisma.InventoryBoxStockUpdateInput {
    return {
      quantity: stock.quantity,
      updatedAt: stock.updatedAt,
    };
  }
}
