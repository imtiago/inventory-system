import { getDb } from "@shared/infrastructure/prisma/transactionContext";
import { Inventory } from "../../../domain/entities/Inventory";
import { IInventoryRepository } from "../../../domain/repositories/InventoryRepository";
import { InventoryMapper } from "../mappers/InventoryMapper";

export class PrismaInventoryRepository implements IInventoryRepository {

  async findByProductVariantId(
    productVariantId: string
  ) {
    const inventory = await getDb().inventory.findUnique({
      where: {
        productVariantId,
      },
    });

    if (!inventory) {
      return null;
    }

    return InventoryMapper.toDomain(inventory);
  }

  async findById(id: string) {
    const data = await getDb().inventory.findUnique({
      where: {
        id,
      },
    });

    if (!data) {
      return null;
    }

    return InventoryMapper.toDomain(data);
  }

  async create(entity: Inventory) {
    const data = await getDb().inventory.create({
      data: InventoryMapper.toCreatePersistence(entity),
    });

    return InventoryMapper.toDomain(data);
  }

  async delete(id: string) {
    await getDb().inventory.delete({
      where: {
        id,
      },
    });
  }

  async update(entity: Inventory): Promise<Inventory> {
    const updated = await getDb().inventory.update({
      where: {
        id: entity.id,
      },
      data: InventoryMapper.toUpdatePersistence(entity),
    });

    return InventoryMapper.toDomain(updated);
  }
}
