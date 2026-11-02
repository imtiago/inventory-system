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
};

const map = (b: Row): BatchListItem => ({
  id: b.id,
  status: b.status,
  source: b.source,
  fileName: b.fileName,
  createdAt: b.createdAt,
  createdBy: b.createdBy,
  summary: { ...EMPTY, ...(b.summary as Partial<BatchSummary>) },
});

const select = {
  id: true,
  status: true,
  source: true,
  fileName: true,
  createdAt: true,
  summary: true,
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
    return row ? map(row) : null;
  }
}
