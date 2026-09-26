import { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../../../../../shared/prisma";
import { Inventory } from "../../../domain/entities/Inventory";
import { IInventoryRepository } from "../../../domain/repositories/InventoryRepository";
import { InventoryMapper } from "../mappers/InventoryMapper";

export class PrismaInventoryRepository implements IInventoryRepository {
  constructor(private readonly prisma: PrismaClient) {}

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

  async findById(id: string) {
    const data = await this.prisma.inventory.findUnique({
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
    const data = await this.prisma.inventory.create({
      data: InventoryMapper.toCreatePersistence(entity),
    });

    return InventoryMapper.toDomain(data);
  }

  async delete(id: string) {
    await this.prisma.inventory.delete({
      where: {
        id,
      },
    });
  }

  async update(entity: Inventory): Promise<Inventory> {
    const updated = await this.prisma.inventory.update({
      where: {
        id: entity.id,
      },
      data: InventoryMapper.toUpdatePersistence(entity),
    });

    return InventoryMapper.toDomain(updated);
  }
}
