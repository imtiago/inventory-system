import { getDb } from "@shared/infrastructure/prisma/transactionContext";
import { IInventoryBoxStockRepository } from "@inventory/domain/repositories/InventoryBoxStockRepository";
import { InventoryBoxStockMapper } from "../mappers/InventoryBoxStockMapper";
import { InventoryBoxStock } from "@inventory/domain/entities/InventoryBoxStock";

export class PrismaInventoryBoxStockRepository implements IInventoryBoxStockRepository {

  async create(entity: InventoryBoxStock): Promise<InventoryBoxStock> {
    const created = await getDb().inventoryBoxStock.create({
      data: InventoryBoxStockMapper.toCreatePersistence(entity),
    });

    return InventoryBoxStockMapper.toDomain(created);
  }

  async update(entity: InventoryBoxStock): Promise<InventoryBoxStock> {
    const data = await getDb().inventoryBoxStock.update({
      where: { id: entity.id },
      data: InventoryBoxStockMapper.toUpdatePersistence(entity),
    });

    return InventoryBoxStockMapper.toDomain(data);
  }

  async findById(id: string): Promise<InventoryBoxStock | null> {
    const data = await getDb().inventoryBoxStock.findUnique({
      where: { id },
    });

    return InventoryBoxStockMapper.toDomain(data);
  }

  async delete(id: string): Promise<void> {
    await getDb().inventoryBoxStock.delete({
      where: { id },
    });
  }

  async findStock(
    inventoryLotId: string,
    boxId: string
  ) {
    const data = await getDb().inventoryBoxStock.findUnique({
      where: {
        inventoryLotId_boxId: {
          inventoryLotId,
          boxId,
        },
      },
    });

    if (!data) {
      return null;
    }

    return InventoryBoxStockMapper.toDomain(data);
  }
}
