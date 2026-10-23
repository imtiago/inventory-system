import { getDb } from "@shared/infrastructure/prisma/transactionContext";
import { StockMovement } from "@inventory/domain/entities/StockMovement";
import { IStockMovementRepository } from "@inventory/domain/repositories/StockMovementRepository";
import { StockMovementOrigin } from "@inventory/domain/enums/StockMovementOrigin";
import { StockMovementMapper } from "../mappers/StockMovementMapper";
import { StockMovementOriginMapper } from "../mappers/StockMovementOriginMapper";

export class PrismaStockMovementRepository implements IStockMovementRepository {

  async create(entity: StockMovement) {
    const created = await getDb().stockMovement.create({
      data: StockMovementMapper.toCreatePersistence(entity),
    });

    return StockMovementMapper.toDomain(created);
  }

  async findById(id: string): Promise<StockMovement | null> {
    const data = await getDb().stockMovement.findUnique({
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
    await getDb().stockMovement.delete({
      where: {
        id,
      },
    });
  }

  async update(entity: StockMovement): Promise<StockMovement> {
    const updated = await getDb().stockMovement.update({
      where: {
        id: entity.id,
      },
      data: StockMovementMapper.toUpdatePersistence(entity),
    });

    return StockMovementMapper.toDomain(updated);
  }

  async findByProductVariantId(
    productVariantId: string
  ): Promise<StockMovement[]> {
    const data = await getDb().stockMovement.findMany({
      where: {
        productVariantId,
      },
    });

    return data.map((d) => StockMovementMapper.toDomain(d));
  }

  async findByOrigin(
    origin: StockMovementOrigin,
    originId: string
  ): Promise<StockMovement[]> {
    const data = await getDb().stockMovement.findMany({
      where: { origin: StockMovementOriginMapper.toPrisma(origin), originId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });

    return data.map((d) => StockMovementMapper.toDomain(d));
  }
}
