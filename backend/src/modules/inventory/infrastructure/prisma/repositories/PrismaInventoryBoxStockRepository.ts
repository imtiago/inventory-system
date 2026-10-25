import { Prisma } from "@prisma/client";
import { getDb, hasActiveTransaction } from "@shared/infrastructure/prisma/transactionContext";
import { InternalErrorCodes, InternalInvariantError } from "@shared/domain/errors";
import {
  BoxAllocation,
  BoxAllocationChange,
  planBoxAllocationReduction,
} from "@inventory/domain/services/boxAllocations";
import { IInventoryBoxStockRepository } from "@inventory/domain/repositories/InventoryBoxStockRepository";
import { InventoryBoxStockMapper } from "../mappers/InventoryBoxStockMapper";
import { InventoryBoxStock } from "@inventory/domain/entities/InventoryBoxStock";

export class PrismaInventoryBoxStockRepository implements IInventoryBoxStockRepository {

  async create(entity: InventoryBoxStock): Promise<InventoryBoxStock> {
    const created = await getDb().inventoryBoxStock.create({
      data: InventoryBoxStockMapper.toCreatePersistence(entity),
    });

    return InventoryBoxStockMapper.toDomain(created);
  }

  async update(entity: InventoryBoxStock): Promise<InventoryBoxStock> {
    const data = await getDb().inventoryBoxStock.update({
      where: { id: entity.id },
      data: InventoryBoxStockMapper.toUpdatePersistence(entity),
    });

    return InventoryBoxStockMapper.toDomain(data);
  }

  async findById(id: string): Promise<InventoryBoxStock | null> {
    const data = await getDb().inventoryBoxStock.findUnique({
      where: { id },
    });

    if (!data) {
      return null;
    }

    return InventoryBoxStockMapper.toDomain(data);
  }

  async delete(id: string): Promise<void> {
    await getDb().inventoryBoxStock.delete({
      where: { id },
    });
  }

  async findStock(
    inventoryLotId: string,
    boxId: string
  ) {
    const data = await getDb().inventoryBoxStock.findUnique({
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

  async sumAllocatedByLot(inventoryLotId: string): Promise<number> {
    const result = await getDb().inventoryBoxStock.aggregate({
      where: { inventoryLotId },
      _sum: { quantity: true },
    });

    return result._sum.quantity ?? 0;
  }

  async reconcileBoxAllocations(lotIds: readonly string[]): Promise<BoxAllocationChange[]> {
    if (!hasActiveTransaction()) {
      throw new InternalInvariantError(
        "Reconciliação de caixas exige transação ativa.",
        InternalErrorCodes.LOCK_OUTSIDE_TRANSACTION,
      );
    }
    const ids = [...new Set(lotIds)];
    if (ids.length === 0) return [];

    // Trava só as alocações (os lotes já foram gravados nesta transação, depois
    // do inventário): ordem inventário → lote → alocações em todos os caminhos.
    const rows = await getDb().$queryRaw<(BoxAllocation & { remainingQuantity: number })[]>`
      SELECT bs."id", bs."inventoryLotId", bs."boxId", bs."quantity", bs."createdAt",
             l."remainingQuantity"
        FROM "InventoryBoxStock" bs
        JOIN "InventoryLot" l ON l."id" = bs."inventoryLotId"
       WHERE bs."inventoryLotId" IN (${Prisma.join(ids)})
       ORDER BY bs."createdAt", bs."id"
         FOR UPDATE OF bs`;

    const remaining = new Map(rows.map((r) => [r.inventoryLotId, r.remainingQuantity]));
    const changes = planBoxAllocationReduction(rows, remaining);
    for (const change of changes) {
      if (change.quantity === 0) {
        await getDb().inventoryBoxStock.delete({ where: { id: change.id } });
      } else {
        await getDb().inventoryBoxStock.update({
          where: { id: change.id },
          data: { quantity: change.quantity },
        });
      }
    }
    return changes;
  }
}
