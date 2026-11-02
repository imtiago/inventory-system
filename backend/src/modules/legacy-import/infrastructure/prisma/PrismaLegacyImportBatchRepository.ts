import { Prisma } from "@prisma/client";
import { InternalErrorCodes, InternalInvariantError } from "@shared/domain/errors";
import { getDb, hasActiveTransaction } from "@shared/infrastructure/prisma/transactionContext";
import type {
  LegacyImportBatchRepository,
  LegacyLimitRule,
  LockedBatch,
  NewRow,
  RowChange,
  StoredRow,
} from "../../application/contracts/LegacyImportBatchRepository";
import type { BatchSummary, ExistingLegacyDebt } from "../../domain/legacyBatchReview";
import type { LegacyRowData } from "../../domain/legacyRow";

const json = (v: unknown) => v as Prisma.InputJsonValue;

type StoredAction = StoredRow["customerAction"] & { acceptDuplicate?: boolean };
/** "Importar mesmo assim" vai no mesmo JSON da decisão sobre o cliente (sem coluna nova). */
const actionJson = (action: StoredRow["customerAction"], acceptDuplicate: boolean) =>
  json(acceptDuplicate ? { ...action, acceptDuplicate: true } : action);

export class PrismaLegacyImportBatchRepository implements LegacyImportBatchRepository {
  async create(input: {
    source: "CSV" | "MANUAL";
    fileName: string | null;
    createdById: string | null;
    fileSha256?: string | null;
  }): Promise<string> {
    const batch = await getDb().legacyImportBatch.create({
      data: {
        source: input.source,
        fileName: input.fileName,
        createdById: input.createdById,
        ...(input.fileSha256 ? { summary: json({ fileSha256: input.fileSha256 }) } : {}),
      },
      select: { id: true },
    });
    return batch.id;
  }

  async lockById(id: string): Promise<LockedBatch | null> {
    if (!hasActiveTransaction()) {
      throw new InternalInvariantError(
        "Trava de lote do caderninho exige transação ativa.",
        InternalErrorCodes.LOCK_OUTSIDE_TRANSACTION,
      );
    }
    const rows = await getDb().$queryRaw<LockedBatch[]>`
      SELECT id, status::text AS status FROM "LegacyImportBatch" WHERE id = ${id} FOR UPDATE`;
    return rows[0] ?? null;
  }

  async rows(batchId: string): Promise<StoredRow[]> {
    const rows = await getDb().legacyImportRow.findMany({
      where: { batchId },
      orderBy: [{ line: "asc" }, { id: "asc" }],
    });
    return rows.map((r) => {
      const { acceptDuplicate, ...customerAction } = r.customerAction as unknown as StoredAction;
      return {
        id: r.id,
        line: r.line,
        raw: r.raw as unknown as StoredRow["raw"],
        data: r.data as unknown as LegacyRowData,
        issues: r.issues as unknown as StoredRow["issues"],
        status: r.status,
        customerAction: customerAction as StoredRow["customerAction"],
        customerId: r.customerId,
        financialDocumentId: r.financialDocumentId,
        acceptDuplicate: acceptDuplicate === true,
      };
    });
  }

  async maxLine(batchId: string): Promise<number> {
    const agg = await getDb().legacyImportRow.aggregate({ where: { batchId }, _max: { line: true } });
    return agg._max.line ?? 1;
  }

  async countRows(batchId: string): Promise<number> {
    return getDb().legacyImportRow.count({ where: { batchId } });
  }

  async insertRows(
    batchId: string,
    rows: (NewRow & Omit<RowChange, "id" | "customerAction" | "raw">)[],
  ): Promise<void> {
    const data = rows.map((r) => ({
      id: r.id,
      batchId,
      line: r.line,
      raw: json(r.raw),
      data: json(r.data),
      issues: json(r.issues),
      status: r.status,
      customerAction: actionJson(r.customerAction, r.acceptDuplicate),
      customerId: r.customerId,
    }));
    await getDb().legacyImportRow.createMany({ data });
  }

  async updateRows(changes: RowChange[]): Promise<void> {
    for (const c of changes) {
      await getDb().legacyImportRow.update({
        where: { id: c.id },
        data: {
          ...(c.raw ? { raw: json(c.raw) } : {}),
          data: json(c.data),
          issues: json(c.issues),
          status: c.status,
          customerAction: actionJson(c.customerAction, c.acceptDuplicate),
          customerId: c.customerId,
        },
      });
    }
  }

  /** Mescla (jsonb ||): preserva chaves que não são do resumo, como `fileSha256`. */
  async saveSummary(batchId: string, summary: BatchSummary): Promise<void> {
    await getDb().$executeRaw`
      UPDATE "LegacyImportBatch" SET summary = summary || ${JSON.stringify(summary)}::jsonb WHERE id = ${batchId}`;
  }

  async delete(id: string): Promise<void> {
    await getDb().legacyImportBatch.delete({ where: { id } });
  }

  async markRowImported(rowId: string, customerId: string, financialDocumentId: string): Promise<void> {
    await getDb().legacyImportRow.update({ where: { id: rowId }, data: { customerId, financialDocumentId } });
  }

  async markConfirmed(batchId: string, input: { userId: string | null; limitRule: LegacyLimitRule }): Promise<void> {
    await getDb().legacyImportBatch.update({
      where: { id: batchId },
      data: { status: "CONFIRMED", limitRule: input.limitRule, confirmedById: input.userId, confirmedAt: new Date() },
    });
  }

  async openLegacyDebts(customerIds: string[]): Promise<ExistingLegacyDebt[]> {
    if (customerIds.length === 0) return [];
    const rows = await getDb().legacyImportRow.findMany({
      where: {
        customerId: { in: [...new Set(customerIds)] },
        batch: { status: "CONFIRMED" },
        financialDocument: { status: { in: ["OPEN", "PARTIALLY_PAID"] } },
      },
      select: { customerId: true, batchId: true, line: true, data: true, financialDocumentId: true },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    return rows.map((r) => ({
      customerId: r.customerId!,
      batchId: r.batchId,
      line: r.line,
      openCents: (r.data as unknown as LegacyRowData).openCents,
      financialDocumentId: r.financialDocumentId!,
    }));
  }

  async markReverted(batchId: string, userId: string | null): Promise<void> {
    await getDb().legacyImportBatch.update({
      where: { id: batchId },
      data: { status: "REVERTED", revertedById: userId, revertedAt: new Date() },
    });
  }
}
