import { InventoryLot } from "@inventory/domain/entities/InventoryLot";
import { InventoryLotSource } from "@inventory/domain/enums/InventoryLotSource";
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

      sourceType: prisma.sourceType as InventoryLotSource,

      sourceId: prisma.sourceId,

      purchaseItemId: prisma.purchaseItemId,

      initialQuantity: prisma.initialQuantity,

      remainingQuantity: prisma.remainingQuantity,

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

      initialQuantity: inventoryLot.initialQuantity,

      remainingQuantity: inventoryLot.remainingQuantity,

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

      ...(inventoryLot.purchaseItemId
        ? { purchaseItem: { connect: { id: inventoryLot.purchaseItemId } } }
        : {}),
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
      initialQuantity: inventoryLot.initialQuantity,

      remainingQuantity: inventoryLot.remainingQuantity,

      unitCost: inventoryLot.unitCost,

      batchNumber: inventoryLot.batchNumber,

      manufacturingDate: inventoryLot.manufacturingDate,

      expirationDate: inventoryLot.expirationDate,

      sourceType: inventoryLot.sourceType,

      sourceId: inventoryLot.sourceId,
    };
  }
}
