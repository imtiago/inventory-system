import { StockMovement as PrismaStockMovement, Prisma } from "@prisma/client";
import { StockMovementTypeMapper } from "./StockMovementTypeMapper";
import { StockMovement } from "@inventory/domain/entities/StockMovement";
import { StockMovementOriginMapper } from "./StockMovementOriginMapper";

export class StockMovementMapper {
  static toDomain(prisma: PrismaStockMovement): StockMovement {
    return new StockMovement({
      id: prisma.id,
      inventoryId: prisma.inventoryId,
      originId: prisma.originId,
      origin: prisma.origin,
      notes: prisma.notes,
      userId: prisma.userId,
      productVariantId: prisma.productVariantId,
      type: StockMovementTypeMapper.toDomain(prisma.type),
      quantity: prisma.quantity,
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
      user: {
        connect: {
          id: movement.userId,
        },
      },
    };
  }
}
