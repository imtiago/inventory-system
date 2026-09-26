import { Prisma, PrismaClient } from "@prisma/client";
import { StockMovement } from "@inventory/domain/entities/StockMovement";
import { IStockMovementRepository } from "@inventory/domain/repositories/StockMovementRepository";
import { StockMovementMapper } from "../mappers/StockMovementMapper";

export class PrismaStockMovementRepository implements IStockMovementRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(entity: StockMovement) {
    const created = await this.prisma.stockMovement.create({
      data: StockMovementMapper.toCreatePersistence(entity),
    });

    return StockMovementMapper.toDomain(created);
  }

  async findById(id: string): Promise<StockMovement | null> {
    const data = await this.prisma.stockMovement.findUnique({
      where: {
        id,
      },
    });

    if (!data) {
      return null;
    }

    return StockMovementMapper.toDomain(data);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.stockMovement.delete({
      where: {
        id,
      },
    });
  }

  async update(entity: StockMovement): Promise<StockMovement> {
    const updated = await this.prisma.stockMovement.update({
      where: {
        id: entity.id,
      },
      data: StockMovementMapper.toCreatePersistence(entity),
    });

    return StockMovementMapper.toDomain(updated);
  }

  async findByProductVariantId(
    productVariantId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<StockMovement[]> {
    const data = await this.prisma.stockMovement.findMany({
      where: {
        productVariantId,
      },
    });

    return data.map((d) => StockMovementMapper.toDomain(d));
  }
}
