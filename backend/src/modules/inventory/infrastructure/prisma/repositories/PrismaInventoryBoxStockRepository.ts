import { Prisma } from "@prisma/client";
import { prisma } from "@shared/prisma";
import { InventoryBoxStockRepository } from "@inventory/domain/repositories/InventoryBoxStockRepository";
import { InventoryBoxStockMapper } from "../mappers/InventoryBoxStockMapper";
import { InventoryBoxStock } from "@inventory/domain/entities/InventoryBoxStock";

export class PrismaInventoryBoxStockRepository implements InventoryBoxStockRepository {
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

  async create(
    stock: InventoryBoxStock,
    tx: Prisma.TransactionClient = prisma,
  ) {
    const created = await tx.inventoryBoxStock.create({
      data: InventoryBoxStockMapper.toCreatePersistence(stock),
    });

    return InventoryBoxStockMapper.toDomain(created);
  }

  async update(
    id: string,
    quantity: number,
    tx: Prisma.TransactionClient = prisma,
  ) {
    const data = await tx.inventoryBoxStock.update({
      where: { id },
      data: { quantity },
    });

    return InventoryBoxStockMapper.toDomain(data);
  }
}
