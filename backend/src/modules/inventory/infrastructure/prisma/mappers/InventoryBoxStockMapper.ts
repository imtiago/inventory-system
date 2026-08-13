import { InventoryBoxStock } from "@inventory/domain/entities/InventoryBoxStock";
import {
  InventoryBoxStock as PrismaInventoryBoxStock,
  Prisma,
} from "@prisma/client";

export class InventoryBoxStockMapper {
  // Banco -> Domínio
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

  // Domínio -> Banco (Create)
  static toCreatePersistence(
    stock: InventoryBoxStock,
  ): Prisma.InventoryBoxStockCreateInput {
    return {
      id: stock.id,
      quantity: stock.quantity,
      updatedAt: stock.updatedAt,
      createdAt: stock.createdAt,
      box: {
        connect: {
          id: stock.boxId,
        },
      },
      inventoryLot: {
        connect: {
          id: stock.inventoryLotId,
        },
      },
    };
  }

  // Domínio -> Banco (Update)
  static toUpdatePersistence(
    stock: InventoryBoxStock,
  ): Prisma.InventoryBoxUpdateInput {
    return {
      // quantity: box.quantity,
      // reservedQuantity: box.reservedQuantity,
      // minimumStock: box.minimumStock,
    };
  }
}
