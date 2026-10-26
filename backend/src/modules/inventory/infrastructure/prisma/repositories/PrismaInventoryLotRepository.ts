import { InternalErrorCodes, InternalInvariantError } from "@shared/domain/errors";
import { getDb, hasActiveTransaction } from "@shared/infrastructure/prisma/transactionContext";

import { IInventoryLotRepository } from "@inventory/domain/repositories/InventoryLotRepository";
import { InventoryLot } from "@inventory/domain/entities/InventoryLot";
import { InventoryLotMapper } from "../mappers/InventoryLotMapper";

export class PrismaInventoryLotRepository implements IInventoryLotRepository {

  async create(entity: InventoryLot): Promise<InventoryLot> {
    const dataCreated = await getDb().inventoryLot.create({
      data: InventoryLotMapper.toCreatePersistence(entity),
    });

    return InventoryLotMapper.toDomain(dataCreated);
  }

  async update(entity: InventoryLot): Promise<InventoryLot> {
    const dataCreated = await getDb().inventoryLot.update({
      where: {
        id: entity.id,
      },
      data: InventoryLotMapper.toUpdatePersistence(entity),
    });

    return InventoryLotMapper.toDomain(dataCreated);
  }

  async delete(id: string): Promise<void> {
    await getDb().inventoryLot.delete({
      where: {
        id,
      },
    });
  }

  async findById(id: string) {
    const inventory = await getDb().inventoryLot.findUnique({
      where: {
        id,
      },
    });

    if (!inventory) {
      return null;
    }

    return InventoryLotMapper.toDomain(inventory);
  }

  async findByProductVariantIdAndBatchNumber(
    productVariantId: string,
    batchNumber: string
  ) {
    const inventory = await getDb().inventoryLot.findFirst({
      where: {
        productVariantId,
        batchNumber,
      },
    });

    if (!inventory) {
      return null;
    }

    return InventoryLotMapper.toDomain(inventory);
  }

  async findAvailableByInventory(
    inventoryId: string
  ) {
    const data = await getDb().inventoryLot.findMany({
      where: {
        inventoryId,

        remainingQuantity: {
          gt: 0,
        },
      },

      // FEFO → mais antigo: validade (sem validade por último), criação, id.
      orderBy: [
        { expirationDate: { sort: "asc", nulls: "last" } },
        { createdAt: "asc" },
        { id: "asc" },
      ],
    });

    return data.map((d) => InventoryLotMapper.toDomain(d));
  }

  async lockByPurchase(purchaseId: string): Promise<InventoryLot[]> {
    if (!hasActiveTransaction()) {
      throw new InternalInvariantError(
        "Trava de lotes exige transação ativa.",
        InternalErrorCodes.LOCK_OUTSIDE_TRANSACTION,
      );
    }
    const db = getDb();
    const rows = await db.$queryRaw<{ id: string }[]>`
      SELECT id FROM "InventoryLot"
       WHERE "sourceType" = 'PURCHASE' AND "sourceId" = ${purchaseId}
       ORDER BY id
         FOR UPDATE`;
    if (rows.length === 0) return [];
    // Leitura após a trava: último estado confirmado (READ COMMITTED).
    const data = await db.inventoryLot.findMany({
      where: { id: { in: rows.map((r) => r.id) } },
      orderBy: { id: "asc" },
    });
    return data.map((d) => InventoryLotMapper.toDomain(d));
  }
}
