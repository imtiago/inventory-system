import { Prisma } from "@prisma/client";
import { prisma } from "../../../../../shared/prisma";

import { Inventory } from "../../../domain/entities/Inventory";
import { InventoryMapper } from "../mappers/InventoryMapper";
import { InventoryLotRepository } from "@inventory/domain/repositories/InventoryLotRepository";

export class PrismaInventoryLotRepository implements InventoryLotRepository {
  async findByVariant(
    productVariantId: string,
    tx: Prisma.TransactionClient = prisma,
  ): Promise<Inventory | null> {
    const inventory = await tx.inventory.findUnique({
      where: {
        productVariantId,
      },
    });

    if (!inventory) {
      return null;
    }

    return InventoryMapper.toDomain(inventory);
  }

  async save(
    inventory: Inventory,
    tx: Prisma.TransactionClient = prisma,
  ): Promise<Inventory> {
    const exists = await tx.inventory.findUnique({
      where: {
        id: inventory.id,
      },
    });

    if (exists) {
      const updated = await tx.inventory.update({
        where: {
          id: inventory.id,
        },
        data: InventoryMapper.toUpdatePersistence(inventory),
      });

      return InventoryMapper.toDomain(updated);
    }

    const created = await tx.inventory.create({
      data: InventoryMapper.toCreatePersistence(inventory),
    });

    return InventoryMapper.toDomain(created);
  }

  //   tx: Prisma.TransactionClient = prisma,
  // ): Promise<StockMovement> {
  //   const created = await tx.stockMovement.create({
  //     data: StockMovementMapper.toCreatePersistence(movement),
  //   });

  //   return StockMovementMapper.toDomain(created);
  // }
}
