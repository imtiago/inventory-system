import { InventoryLot } from "@inventory/domain/entities/InventoryLot";
import { InventoryLot as PrismaInventoryLot, Prisma } from "@prisma/client";

export class InventoryLotMapper {
  // Banco -> Domínio
  static toDomain(prisma: PrismaInventoryLot): InventoryLot {
    return new InventoryLot({
      id: prisma.id,
      inventoryId: prisma.inventoryId,
      quantity: prisma.quantity,
      unitCost: prisma.unitCost,
      // productVariantId: prisma.productVariant.id,

      // productVariantId: prisma.productVariantId,
      // quantity: prisma.quantity,
      // reservedQuantity: prisma.reservedQuantity,
      // minimumStock: prisma.minimumStock,
      createdAt: prisma.createdAt,
    });
  }

  // Domínio -> Banco (Create)
  static toCreatePersistence(
    inventoryLot: InventoryLot,
  ): Prisma.InventoryLotCreateInput {
    return {
      id: inventoryLot.id,
      initialQuantity: inventoryLot.quantity,
      unitCost: inventoryLot.unitCost,
      remainingQuantity: inventoryLot.quantity,
      createdAt: inventoryLot.createdAt,
      sourceType: inventoryLot.sourceType,
      inventory: {
        connect: {
          id: inventoryLot.inventoryId,
        },
      },
      productVariant: {
        connect: {
          id: inventoryLot.productVariantId,
        },
      },
    };
  }

  // Domínio -> Banco (Update)
  static toUpdatePersistence(
    inventory: InventoryLot,
  ): Prisma.InventoryUpdateInput {
    return {
      quantity: inventory.quantity,
      reservedQuantity: inventory.reservedQuantity,
      minimumStock: inventory.minimumStock,
    };
  }
}
