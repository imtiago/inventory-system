import { Prisma } from "@prisma/client";
import { prisma } from "../../../../shared/prisma";

import { Inventory } from "../../domain/entities/Inventory";
import { StockMovement } from "../../domain/entities/StockMovement";

import { InventoryRepository } from "../../domain/repositories/InventoryRepository";

import { InventoryMapper } from "../mappers/InventoryMapper";
import { StockMovementMapper } from "../mappers/StockMovementMapper";

export class PrismaInventoryRepository implements InventoryRepository {
  async findByVariant(
    variantId: string,
    tx: Prisma.TransactionClient = prisma,
  ): Promise<Inventory | null> {
    const inventory = await tx.inventory.findUnique({
      where: {
        productVariantId: variantId,
      },
    });

    if (!inventory) {
      return null;
    }

    return InventoryMapper.toDomain(inventory);
  }

  async create(inventory: Inventory): Promise<Inventory> {
    const created = await prisma.inventory.create({
      data: InventoryMapper.toCreatePersistence(inventory),
    });

    return InventoryMapper.toDomain(created);
  }

  async update(
    inventory: Inventory,
    tx: Prisma.TransactionClient = prisma,
  ): Promise<Inventory> {
    const updated = await tx.inventory.update({
      where: {
        id: inventory.id,
      },
      data: InventoryMapper.toUpdatePersistence(inventory),
    });

    return InventoryMapper.toDomain(updated);
  }

  async addMovement(movement: StockMovement): Promise<StockMovement> {
    const created = await prisma.stockMovement.create({
      data: StockMovementMapper.toCreatePersistence(movement),
    });

    return StockMovementMapper.toDomain(created);
  }
}
