import { FinancialDocument } from "@finance/domain/entities/FinancialDocument";
import { FinancialOriginType } from "@finance/domain/enums/FinancialOriginType";
import { FinancialType } from "@finance/domain/enums/FinancialType";
import { FinancialDocumentRepository } from "@finance/domain/repositories/FinancialDocumentRepository";
import { InternalErrorCodes, InternalInvariantError } from "@shared/domain/errors";
import { getDb, hasActiveTransaction } from "@shared/infrastructure/prisma/transactionContext";
import { FinancialDocumentMapper } from "../mappers/FinancialDocumentMapper";

export class PrismaFinancialDocumentRepository implements FinancialDocumentRepository {
  async create(data: FinancialDocument) {
    const receivable = await getDb().financialDocument.create({
      data: FinancialDocumentMapper.toCreatePersistence(data),
    });

    return FinancialDocumentMapper.toDomain(receivable);
  }

  async lockById(id: string): Promise<FinancialDocument | null> {
    this.assertTransaction();
    const db = getDb();
    // Mesma linha travada pelo cancelamento da venda (lockByOrigin): serializa pagamento × cancelamento.
    const rows = await db.$queryRaw<{ id: string }[]>`
      SELECT id FROM "FinancialDocument" WHERE id = ${id} FOR UPDATE`;
    if (rows.length === 0) return null;

    // Lido depois da trava: vê o estado confirmado mais recente (READ COMMITTED).
    const document = await db.financialDocument.findUnique({
      where: { id },
      include: { parcels: { include: { payments: true } } },
    });
    return document ? FinancialDocumentMapper.toDomain(document) : null;
  }

  private assertTransaction(): void {
    if (!hasActiveTransaction()) {
      throw new InternalInvariantError(
        "Trava de documento financeiro exige transação ativa.",
        InternalErrorCodes.LOCK_OUTSIDE_TRANSACTION,
      );
    }
  }

  async lockByOrigin(
    type: FinancialType,
    originType: FinancialOriginType,
    originId: string,
  ): Promise<FinancialDocument[]> {
    this.assertTransaction();
    const db = getDb();
    const rows = await db.$queryRaw<{ id: string }[]>`
      SELECT id FROM "FinancialDocument"
      WHERE "type"::text = ${type} AND "originType"::text = ${originType} AND "originId" = ${originId}
      ORDER BY id
      FOR UPDATE`;
    if (rows.length === 0) return [];

    const documents = await db.financialDocument.findMany({
      where: { id: { in: rows.map((r) => r.id) } },
      include: { parcels: true },
      orderBy: { id: "asc" },
    });

    return documents.map((d) => FinancialDocumentMapper.toDomain(d));
  }

  async hasPayments(documentIds: string[]): Promise<boolean> {
    if (documentIds.length === 0) return false;
    const count = await getDb().payment.count({
      where: { reversedAt: null, parcel: { financialDocumentId: { in: documentIds } } },
    });

    return count > 0;
  }

  async update(document: FinancialDocument): Promise<FinancialDocument> {
    const updated = await getDb().financialDocument.update({
      where: { id: document.id },
      data: FinancialDocumentMapper.toUpdatePersistence(document),
      include: { parcels: true },
    });

    return FinancialDocumentMapper.toDomain(updated);
  }
}
