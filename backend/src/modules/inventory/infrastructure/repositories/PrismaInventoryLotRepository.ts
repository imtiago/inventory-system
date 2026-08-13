// infrastructure/repositories/PrismaInventoryRepository.ts

import { InventoryLot } from "@inventory/domain/entities/InventoryLot";
import { InventoryLotRepository } from "@inventory/domain/repositories/InventoryLotRepository";
import { Prisma } from "@prisma/client";
import { prisma } from "@shared/prisma";
import { InventoryLotMapper } from "../prisma/mappers/InventoryLotMapper";

export class PrismaInventoryLotRepository implements InventoryLotRepository {
  async findByVariant(
    productVariantId: string,
    tx: Prisma.TransactionClient = prisma,
  ) {
    // console.log(productVariantId);
    const inventory = await tx.inventoryLot.findUnique({
      where: {
        id: "f0739bcc-9556-460f-8960-5c73c829dc28",
        // productVariantId,
        // productVariantId,
      },
    });

    if (!inventory) {
      return null;
    }

    return InventoryLotMapper.toDomain(inventory);
  }
  async findById(id: string, tx: Prisma.TransactionClient = prisma) {
    const inventory = await tx.inventoryLot.findUnique({
      where: {
        id,
      },
    });

    if (!inventory) {
      return null;
    }

    return InventoryLotMapper.toDomain(inventory);
  }

  async save(
    inventoryLot: InventoryLot,
    tx: Prisma.TransactionClient = prisma,
  ) {
    const exists = await tx.inventoryLot.findUnique({
      where: {
        id: inventoryLot.id,
      },
    });

    if (exists) {
      const updated = await tx.inventoryLot.update({
        where: {
          id: inventoryLot.id,
        },
        data: InventoryLotMapper.toUpdatePersistence(inventoryLot),
      });

      return InventoryLotMapper.toDomain(updated);
    }

    const created = await tx.inventoryLot.create({
      data: InventoryLotMapper.toCreatePersistence(inventoryLot),
    });

    return InventoryLotMapper.toDomain(created);
  }

  async findAvailableByInventory(
    inventoryId: string,
    tx: Prisma.TransactionClient = prisma,
  ) {
    const data = await tx.inventoryLot.findMany({
      where: {
        inventoryId,

        remainingQuantity: {
          gt: 0,
        },
      },

      orderBy: {
        createdAt: "asc",
      },
    });

    return data.map((d) => InventoryLotMapper.toDomain(d));
  }
}
