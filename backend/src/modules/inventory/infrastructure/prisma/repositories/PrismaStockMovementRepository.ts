import { Prisma } from "@prisma/client";
import { prisma } from "@shared/prisma";

import { StockMovement } from "@inventory/domain/entities/StockMovement";
import { StockMovementRepository } from "@inventory/domain/repositories/StockMovementRepository";
import { StockMovementMapper } from "../mappers/StockMovementMapper";

export class PrismaStockMovementRepository implements StockMovementRepository {
  async create(
    movement: StockMovement,
    tx: Prisma.TransactionClient = prisma,
  ): Promise<StockMovement> {
    const created = await tx.stockMovement.create({
      data: StockMovementMapper.toCreatePersistence(movement),
    });

    return StockMovementMapper.toDomain(created);
  }

  async findById(
    id: string,
    tx: Prisma.TransactionClient = prisma,
  ): Promise<StockMovement | null> {
    const data = await tx.stockMovement.findUnique({
      where: {
        id,
      },
    });

    if (!data) {
      return null;
    }

    return StockMovementMapper.toDomain(data);
  }
}
