import { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@shared/prisma";
import { IInventoryBoxRepository } from "@inventory/domain/repositories/InventoryBoxRepository";
import { InventoryBoxMapper } from "../mappers/InventoryBoxMapper";
import { InventoryBox } from "@inventory/domain/entities/InventoryBox";

export class PrismaInventoryBoxRepository implements IInventoryBoxRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(entity: InventoryBox): Promise<InventoryBox> {
    const created = await this.prisma.inventoryBox.create({
      data: InventoryBoxMapper.toCreatePersistence(entity),
    });

    return InventoryBoxMapper.toDomain(created);
  }

  async update(entity: InventoryBox): Promise<InventoryBox> {
    const updated = await this.prisma.inventoryBox.update({
      where: {
        id: entity.id,
      },
      data: InventoryBoxMapper.toUpdatePersistence(entity),
    });

    return InventoryBoxMapper.toDomain(updated);
  }
  async findById(id: string): Promise<InventoryBox | null> {
    const exists = await this.prisma.inventoryBox.findUnique({
      where: {
        id,
      },
    });
    if (!exists) return null;
    return InventoryBoxMapper.toDomain(exists);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.inventoryBox.delete({
      where: {
        id,
      },
    });
  }

  async findByCode(code: string, tx: Prisma.TransactionClient = prisma) {
    const data = await tx.inventoryBox.findUnique({
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
