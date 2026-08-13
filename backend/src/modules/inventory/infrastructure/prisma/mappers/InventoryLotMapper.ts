import { InventoryLot } from "@inventory/domain/entities/InventoryLot";
import { InventoryLot as PrismaInventoryLot, Prisma } from "@prisma/client";

export class InventoryLotMapper {
  /**
   * Banco -> Domínio
   */
  static toDomain(prisma: PrismaInventoryLot): InventoryLot {
    return new InventoryLot({
      id: prisma.id,

      inventoryId: prisma.inventoryId,

      productVariantId: prisma.productVariantId,

      sourceType: prisma.sourceType,

      sourceId: prisma.sourceId,

      quantity: prisma.initialQuantity,

      availableQuantity: prisma.remainingQuantity,

      unitCost: Number(prisma.unitCost),

      batchNumber: prisma.batchNumber,

      manufacturingDate: prisma.manufacturingDate,

      expirationDate: prisma.expirationDate,

      createdAt: prisma.createdAt,
    });
  }

  /**
   * Domínio -> Banco
   * CREATE
   */
  static toCreatePersistence(
    inventoryLot: InventoryLot,
  ): Prisma.InventoryLotCreateInput {
    return {
      id: inventoryLot.id,

      initialQuantity: inventoryLot.quantity,

      remainingQuantity: inventoryLot.availableQuantity,

      unitCost: inventoryLot.unitCost,

      batchNumber: inventoryLot.batchNumber,

      manufacturingDate: inventoryLot.manufacturingDate,

      expirationDate: inventoryLot.expirationDate,

      sourceType: inventoryLot.sourceType,

      sourceId: inventoryLot.sourceId,

      createdAt: inventoryLot.createdAt,

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

  /**
   * Domínio -> Banco
   * UPDATE
   */
  static toUpdatePersistence(
    inventoryLot: InventoryLot,
  ): Prisma.InventoryLotUpdateInput {
    return {
      initialQuantity: inventoryLot.quantity,

      remainingQuantity: inventoryLot.availableQuantity,

      unitCost: inventoryLot.unitCost,

      batchNumber: inventoryLot.batchNumber,

      manufacturingDate: inventoryLot.manufacturingDate,

      expirationDate: inventoryLot.expirationDate,

      sourceType: inventoryLot.sourceType,

      sourceId: inventoryLot.sourceId,
    };
  }
}
