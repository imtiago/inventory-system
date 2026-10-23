import { InternalErrorCodes, InternalInvariantError } from "@shared/domain/errors";
import { getDb, hasActiveTransaction } from "@shared/infrastructure/prisma/transactionContext";
import { Purchase } from "@purchases/domain/entities/Purchase";
import { PurchaseRepository } from "@purchases/domain/repositories/PurchaseRepository";
import { PurchaseMapper } from "../mappers/PurchaseMapper";

export class PrismaPurchaseRepository implements PurchaseRepository {
  async create(purchase: Purchase): Promise<Purchase> {
    const row = await getDb().purchase.create({
      data: PurchaseMapper.toCreatePersistence(purchase),
      include: { items: true },
    });
    return PurchaseMapper.toDomain(row);
  }

  async lockById(id: string): Promise<Purchase | null> {
    if (!hasActiveTransaction()) {
      throw new InternalInvariantError(
        "Trava de pedido de compra exige transação ativa.",
        InternalErrorCodes.LOCK_OUTSIDE_TRANSACTION,
      );
    }
    const db = getDb();
    const rows = await db.$queryRaw<{ id: string }[]>`
      SELECT id FROM "Purchase" WHERE id = ${id} FOR UPDATE`;
    if (rows.length === 0) return null;
    // Leitura após a trava: enxerga o último estado confirmado (READ COMMITTED).
    const row = await db.purchase.findUnique({ where: { id }, include: { items: true } });
    return row ? PurchaseMapper.toDomain(row) : null;
  }

  async update(purchase: Purchase): Promise<Purchase> {
    const row = await getDb().purchase.update({
      where: { id: purchase.id },
      data: PurchaseMapper.toUpdatePersistence(purchase),
      include: { items: true },
    });
    return PurchaseMapper.toDomain(row);
  }
}
