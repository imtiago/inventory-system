import { StockMovement as PrismaStockMovement, Prisma } from "@prisma/client";
import { StockMovementTypeMapper } from "./StockMovementTypeMapper";
import { StockMovement } from "@inventory/domain/entities/StockMovement";

export class StockMovementMapper {
  static toDomain(prisma: PrismaStockMovement): StockMovement {
    return new StockMovement({
      id: prisma.id,

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

      type: StockMovementTypeMapper.toPrisma(movement.type),

      quantity: movement.quantity,

      createdAt: movement.createdAt,

      productVariant: {
        connect: {
          id: movement.productVariantId,
        },
      },
    };
  }
}
