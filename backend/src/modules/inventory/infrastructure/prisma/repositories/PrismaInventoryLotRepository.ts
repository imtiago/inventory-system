import { getDb } from "@shared/infrastructure/prisma/transactionContext";

import { IInventoryLotRepository } from "@inventory/domain/repositories/InventoryLotRepository";
import { InventoryLot } from "@inventory/domain/entities/InventoryLot";
import { InventoryLotMapper } from "../mappers/InventoryLotMapper";

export class PrismaInventoryLotRepository implements IInventoryLotRepository {

  async create(entity: InventoryLot): Promise<InventoryLot> {
    const dataCreated = await getDb().inventoryLot.create({
      data: InventoryLotMapper.toCreatePersistence(entity),
    });

    return InventoryLotMapper.toDomain(dataCreated);
  }

  async update(entity: InventoryLot): Promise<InventoryLot> {
    const dataCreated = await getDb().inventoryLot.update({
      where: {
        id: entity.id,
      },
      data: InventoryLotMapper.toUpdatePersistence(entity),
    });

    return InventoryLotMapper.toDomain(dataCreated);
  }

  async delete(id: string): Promise<void> {
    await getDb().inventoryLot.delete({
      where: {
        id,
      },
    });
  }

  async findById(id: string) {
    const inventory = await getDb().inventoryLot.findUnique({
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
    batchNumber: string
  ) {
    const inventory = await getDb().inventoryLot.findFirst({
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
    inventoryId: string
  ) {
    const data = await getDb().inventoryLot.findMany({
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
