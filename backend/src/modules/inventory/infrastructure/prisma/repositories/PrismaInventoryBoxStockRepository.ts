import { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@shared/prisma";
import { IInventoryBoxStockRepository } from "@inventory/domain/repositories/InventoryBoxStockRepository";
import { InventoryBoxStockMapper } from "../mappers/InventoryBoxStockMapper";
import { InventoryBoxStock } from "@inventory/domain/entities/InventoryBoxStock";

export class PrismaInventoryBoxStockRepository implements IInventoryBoxStockRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(entity: InventoryBoxStock): Promise<InventoryBoxStock> {
    const created = await this.prisma.inventoryBoxStock.create({
      data: InventoryBoxStockMapper.toCreatePersistence(entity),
    });

    return InventoryBoxStockMapper.toDomain(created);
  }

  async update(entity: InventoryBoxStock): Promise<InventoryBoxStock> {
    const data = await this.prisma.inventoryBoxStock.update({
      where: { id: entity.id },
      data: InventoryBoxStockMapper.toUpdatePersistence(entity),
    });

    return InventoryBoxStockMapper.toDomain(data);
  }

  async findById(id: string): Promise<InventoryBoxStock | null> {
    const data = await this.prisma.inventoryBoxStock.findUnique({
      where: { id },
    });

    return InventoryBoxStockMapper.toDomain(data);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.inventoryBoxStock.delete({
      where: { id },
    });
  }

  async findStock(
    inventoryLotId: string,
    boxId: string,
    tx: Prisma.TransactionClient = prisma,
  ) {
    const data = await tx.inventoryBoxStock.findUnique({
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
