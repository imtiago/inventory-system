import { Inventory } from "@inventory/domain/entities/Inventory";
import { InventoryRepository } from "@inventory/domain/repositories/InventoryRepository";
import { Prisma } from "@prisma/client";
import { prisma } from "@shared/prisma";
import { InventoryMapper } from "../prisma/mappers/InventoryMapper";

export class PrismaInventoryRepository implements InventoryRepository {
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

  async findById(
    id: string,
    tx: Prisma.TransactionClient = prisma,
  ): Promise<Inventory | null> {
    const inventory = await tx.inventory.findUnique({
      where: {
        id,
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
}
