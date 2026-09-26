import { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../../../../../shared/prisma";

import { InventoryMapper } from "../mappers/InventoryMapper";
import { IInventoryLotRepository } from "@inventory/domain/repositories/InventoryLotRepository";
import { InventoryLot } from "@inventory/domain/entities/InventoryLot";
import { InventoryLotMapper } from "../mappers/InventoryLotMapper";

export class PrismaInventoryLotRepository implements IInventoryLotRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(entity: InventoryLot): Promise<InventoryLot> {
    console.log(entity);
    const dataCreated = await this.prisma.inventoryLot.create({
      data: InventoryLotMapper.toCreatePersistence(entity),
    });

    return InventoryLotMapper.toDomain(dataCreated);
  }

  async update(entity: InventoryLot): Promise<InventoryLot> {
    const dataCreated = await this.prisma.inventoryLot.update({
      where: {
        id: entity.id,
      },
      data: InventoryLotMapper.toUpdatePersistence(entity),
    });

    return InventoryLotMapper.toDomain(dataCreated);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.inventoryLot.delete({
      where: {
        id,
      },
    });
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

  async findByProductVariantIdAndBatchNumber(
    productVariantId: string,
    batchNumber: string,
    tx: Prisma.TransactionClient = prisma,
  ) {
    const inventory = await tx.inventoryLot.findFirst({
      where: {
        productVariantId,
        batchNumber,
      },
    });

    if (!inventory) {
      return null;
    }

    return InventoryLotMapper.toDomain(inventory);
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

  async findByProductVariantId(
    productVariantId: string,
    tx: Prisma.TransactionClient = prisma,
  ) {
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
}
