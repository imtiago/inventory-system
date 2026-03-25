// backend/src/modules/inventory/infrastructure/repositories/PrismaInventoryRepository.ts
import { prisma } from "../../../../shared/prisma";
import { InventoryRepository } from "../../domain/repositories/InventoryRepository";
import { Inventory } from "../../domain/entities/Inventory";
import { StockMovement } from "../../domain/entities/StockMovement";
import { Prisma, StockMovementType } from "@prisma/client";

export class PrismaInventoryRepository implements InventoryRepository {
  // Exemplo do findByVariant
  async findByVariant(variantId: string, tx = prisma) {
    return tx.inventory.findUnique({
      where: { productVariantId: variantId },
    });
  }

  async create(data: {
    productVariantId: string;
    quantity?: number;
    reservedQuantity?: number;
    minimumStock?: number;
  }): Promise<Inventory> {
    const inv = await prisma.inventory.create({
      data: {
        productVariantId: data.productVariantId,
        quantity: data.quantity ?? 0,
        reservedQuantity: data.reservedQuantity ?? 0,
        minimumStock: data.minimumStock ?? 0,
      },
    });

    return new Inventory({
      id: inv.id,
      productVariantId: inv.productVariantId,
      quantity: inv.quantity,
      reservedQuantity: inv.reservedQuantity,
      minimumStock: inv.minimumStock,
      createdAt: inv.createdAt,
    });
  }

  async update(
    inventory: Inventory,
    tx: Prisma.TransactionClient = prisma,
  ): Promise<Inventory> {
    return tx.inventory.update({
      where: { id: inventory.id },
      data: {
        quantity: inventory.quantity,
      },
    });
  }

  async addMovement(data: {
    productVariantId: string;
    type: StockMovementType;
    quantity: number;
  }): Promise<StockMovement> {
    const movement = await prisma.stockMovement.create({
      data: {
        productVariantId: data.productVariantId,
        type: data.type,
        quantity: data.quantity,
      },
    });

    return new StockMovement({
      id: movement.id,
      productVariantId: movement.productVariantId,
      type: movement.type as StockMovementType,
      quantity: movement.quantity,
      createdAt: movement.createdAt,
    });
  }
}
