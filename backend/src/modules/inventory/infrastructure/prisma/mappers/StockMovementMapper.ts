import { StockMovement as PrismaStockMovement, Prisma } from "@prisma/client";
import { StockMovementOrigin } from "@inventory/domain/enums/StockMovementOrigin";
import { StockMovementTypeMapper } from "./StockMovementTypeMapper";
import { StockMovement } from "@inventory/domain/entities/StockMovement";
import { StockMovementOriginMapper } from "./StockMovementOriginMapper";

export class StockMovementMapper {
  static toDomain(prisma: PrismaStockMovement): StockMovement {
    return new StockMovement({
      id: prisma.id,
      inventoryId: prisma.inventoryId,
      inventoryLotId: prisma.inventoryLotId,
      originId: prisma.originId,
      origin: prisma.origin as StockMovementOrigin,
      notes: prisma.notes,
      userId: prisma.userId,
      productVariantId: prisma.productVariantId,
      type: StockMovementTypeMapper.toDomain(prisma.type),
      quantity: prisma.quantity,
      // Movimentações legadas têm saldos nulos: repassa os NULLs.
      previousQuantity: prisma.previousQuantity,
      currentQuantity: prisma.currentQuantity,
      averageCost:
        prisma.averageCost === null ? null : Number(prisma.averageCost),
      createdAt: prisma.createdAt,
    });
  }

  static toCreatePersistence(
    movement: StockMovement,
  ): Prisma.StockMovementCreateInput {
    return {
      id: movement.id,
      origin: StockMovementOriginMapper.toPrisma(movement.origin),
      type: StockMovementTypeMapper.toPrisma(movement.type),

      quantity: movement.quantity,
      previousQuantity: movement.previousQuantity,
      currentQuantity: movement.currentQuantity,
      averageCost: movement.averageCost,
      originId: movement.originId,
      notes: movement.notes,
      createdAt: movement.createdAt,
      productVariant: {
        connect: {
          id: movement.productVariantId,
        },
      },
      inventory: {
        connect: {
          id: movement.inventoryId,
        },
      },
      ...(movement.inventoryLotId
        ? { inventoryLot: { connect: { id: movement.inventoryLotId } } }
        : {}),
      ...(movement.userId
        ? { user: { connect: { id: movement.userId } } }
        : {}),
    };
  }

  static toUpdatePersistence(
    movement: StockMovement,
  ): Prisma.StockMovementUpdateInput {
    return {
      notes: movement.notes,
    };
  }
}
