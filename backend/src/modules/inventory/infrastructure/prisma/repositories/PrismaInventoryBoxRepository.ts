import { Prisma } from "@prisma/client";
import { prisma } from "@shared/prisma";
import { InventoryBoxRepository } from "@inventory/domain/repositories/InventoryBoxRepository";
import { InventoryBoxMapper } from "../mappers/InventoryBoxMapper";
import { InventoryBox } from "@inventory/domain/entities/InventoryBox";

export class PrismaInventoryBoxRepository implements InventoryBoxRepository {
  async findById(id: string, tx: Prisma.TransactionClient = prisma) {
    const data = await tx.inventoryBox.findUnique({
      where: {
        id,
      },
    });

    if (!data) {
      return null;
    }

    return InventoryBoxMapper.toDomain(data);
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

  async save(box: InventoryBox, tx: Prisma.TransactionClient = prisma) {
    const exists = await tx.inventory.findUnique({
      where: {
        id: box.id,
      },
    });

    if (exists) {
      const updated = await tx.inventoryBox.update({
        where: {
          id: box.id,
        },
        data: InventoryBoxMapper.toUpdatePersistence(box),
      });

      return InventoryBoxMapper.toDomain(updated);
    }

    const created = await tx.inventoryBox.create({
      data: InventoryBoxMapper.toCreatePersistence(box),
    });

    return InventoryBoxMapper.toDomain(created);
  }
}
