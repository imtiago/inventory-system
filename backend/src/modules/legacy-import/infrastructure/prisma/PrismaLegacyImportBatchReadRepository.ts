import { getDb } from "@shared/infrastructure/prisma/transactionContext";
import { readTogether } from "@shared/infrastructure/database/readTogether";
import type { BatchSummary } from "../../domain/legacyBatchReview";
import type { BatchHeader, BatchListItem, LegacyImportBatchReadRepository } from "../../application/contracts/LegacyImportBatchRepository";

const EMPTY: BatchSummary = { newCustomers: 0, existingCustomers: 0, openTotal: 0, rows: 0, warnings: 0, errors: 0, ignored: 0 };

type Row = {
  id: string;
  status: BatchListItem["status"];
  source: BatchListItem["source"];
  fileName: string | null;
  createdAt: Date;
  summary: unknown;
  createdBy: { id: string; name: string } | null;
  limitRule: string;
  confirmedAt: Date | null;
  revertedAt: Date | null;
};

/** Só as chaves do resumo (o JSON guarda também `fileSha256`). */
const summaryOf = (raw: unknown): BatchSummary => {
  const all: Record<string, unknown> = { ...EMPTY, ...(raw as Partial<BatchSummary>) };
  return Object.fromEntries(Object.keys(EMPTY).map((k) => [k, all[k]])) as unknown as BatchSummary;
};

const map = (b: Row): BatchListItem => ({
  id: b.id,
  status: b.status,
  source: b.source,
  fileName: b.fileName,
  createdAt: b.createdAt,
  createdBy: b.createdBy,
  summary: summaryOf(b.summary),
  limitRule: b.limitRule === "PROFILE_ONLY" ? "PROFILE_ONLY" : "MAX_OF_PROFILE_AND_BALANCE",
  confirmedAt: b.confirmedAt,
  revertedAt: b.revertedAt,
});

const select = {
  id: true,
  status: true,
  source: true,
  fileName: true,
  createdAt: true,
  summary: true,
  limitRule: true,
  confirmedAt: true,
  revertedAt: true,
  createdBy: { select: { id: true, name: true } },
} as const;

export class PrismaLegacyImportBatchReadRepository implements LegacyImportBatchReadRepository {
  async list(page: number, limit: number) {
    const db = getDb();
    const [rows, total] = await readTogether([
      db.legacyImportBatch.findMany({
        select,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.legacyImportBatch.count(),
    ]);
    return { items: rows.map(map), total };
  }

  async header(id: string): Promise<BatchHeader | null> {
    const row = await getDb().legacyImportBatch.findUnique({ where: { id }, select });
    if (!row) return null;
    const hash = (row.summary as { fileSha256?: unknown } | null)?.fileSha256;
    return { ...map(row), fileSha256: typeof hash === "string" ? hash : null };
  }

  async confirmedWithFile(fileSha256: string, excludeId: string) {
    const row = await getDb().legacyImportBatch.findFirst({
      where: { status: "CONFIRMED", id: { not: excludeId }, summary: { path: ["fileSha256"], equals: fileSha256 } },
      select: { id: true, confirmedAt: true },
      orderBy: [{ confirmedAt: "desc" }, { id: "asc" }],
    });
    return row && row.confirmedAt ? { id: row.id, confirmedAt: row.confirmedAt } : null;
  }
}
