import { getDb } from "@shared/infrastructure/prisma/transactionContext";
import { IInventoryBoxRepository } from "@inventory/domain/repositories/InventoryBoxRepository";
import { InventoryBoxMapper } from "../mappers/InventoryBoxMapper";
import { InventoryBox } from "@inventory/domain/entities/InventoryBox";

export class PrismaInventoryBoxRepository implements IInventoryBoxRepository {

  async create(entity: InventoryBox): Promise<InventoryBox> {
    const created = await getDb().inventoryBox.create({
      data: InventoryBoxMapper.toCreatePersistence(entity),
    });

    return InventoryBoxMapper.toDomain(created);
  }

  async update(entity: InventoryBox): Promise<InventoryBox> {
    const updated = await getDb().inventoryBox.update({
      where: {
        id: entity.id,
      },
      data: InventoryBoxMapper.toUpdatePersistence(entity),
    });

    return InventoryBoxMapper.toDomain(updated);
  }
  async findById(id: string): Promise<InventoryBox | null> {
    const exists = await getDb().inventoryBox.findUnique({
      where: {
        id,
      },
    });
    if (!exists) return null;
    return InventoryBoxMapper.toDomain(exists);
  }

  async delete(id: string): Promise<void> {
    await getDb().inventoryBox.delete({
      where: {
        id,
      },
    });
  }

  async findByCode(code: string) {
    const data = await getDb().inventoryBox.findUnique({
      where: {
        code,
      },
    });

    if (!data) {
      return null;
    }

    return InventoryBoxMapper.toDomain(data);
  }
}
