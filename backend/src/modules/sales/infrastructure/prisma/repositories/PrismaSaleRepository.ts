import { SaleMapper } from "../mappers/SaleMapper";
import { SaleStatusMapper } from "../mappers/SaleStatusMapper";
import { getDb, hasActiveTransaction } from "@shared/infrastructure/prisma/transactionContext";
import { InternalErrorCodes, InternalInvariantError } from "@shared/domain/errors";
import { Sale } from "@sales/domain/entities/Sale";
import { SaleRepository } from "@sales/domain/repositories/SaleRepository";

export class PrismaSaleRepository implements SaleRepository {
  async create(sale: Sale): Promise<Sale> {
    const created = await getDb().sale.create({
      data: SaleMapper.toCreatePersistence(sale),
      include: { items: true },
    });
    return SaleMapper.toDomain(created);
  }

  async findById(id: string): Promise<Sale | null> {
    const sale = await getDb().sale.findUnique({
      where: { id },
      include: { items: true },
    });
    return sale ? SaleMapper.toDomain(sale) : null;
  }

  async lockById(id: string): Promise<Sale | null> {
    if (!hasActiveTransaction()) {
      throw new InternalInvariantError(
        "Trava de venda exige transação ativa.",
        InternalErrorCodes.LOCK_OUTSIDE_TRANSACTION,
      );
    }
    const rows = await getDb().$queryRaw<{ id: string }[]>`
      SELECT id FROM "Sale" WHERE id = ${id} FOR UPDATE`;
    if (rows.length === 0) return null;
    // Leitura após a trava: enxerga o último estado confirmado.
    return this.findById(id);
  }

  async update(sale: Sale): Promise<Sale> {
    const updated = await getDb().sale.update({
      where: { id: sale.id },
      data: { status: SaleStatusMapper.toPrisma(sale.status) },
      include: { items: true },
    });
    return SaleMapper.toDomain(updated);
  }
}
