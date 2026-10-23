import { Prisma } from "@prisma/client";
import { PaginatedResult } from "@shared/application/dtos/PaginatedResult";
import { PaginationRequest } from "@shared/application/dtos/PaginationRequest";
import { buildPaginatedResult } from "@shared/infrastructure/database/buildPaginatedResult";
import { buildPagination } from "@shared/infrastructure/database/buildPagination";
import { getDb } from "@shared/infrastructure/prisma/transactionContext";
import { fromCents, toCents } from "@shared/domain/money";
import { NfeDocument } from "@nfe-import/domain/NfeDocument";
import { NfeImportStatus } from "@nfe-import/domain/NfeImportStatus";
import {
  NfeImportListFilters,
  NfeImportReadRepository,
  NfeImportRecord,
} from "@nfe-import/application/contracts/NfeImportReadRepository";
import { NfeImportSummaryDTO } from "@nfe-import/application/dto/NfeImportDTO";

type SummaryRow = {
  id: string;
  accessKey: string;
  status: NfeImportStatus;
  number: string;
  series: string;
  issueDate: Date;
  totalAmount: Prisma.Decimal;
  supplierDocument: string;
  supplierName: string;
  itemsCount: number;
  purchaseId: string | null;
  createdAt: Date;
};

export class PrismaNfeImportReadRepository implements NfeImportReadRepository {
  /** Lista sem carregar o `payload` inteiro: número, série e nº de itens saem do JSON no SQL. */
  async list(
    pagination: PaginationRequest,
    filters?: NfeImportListFilters,
  ): Promise<PaginatedResult<NfeImportSummaryDTO>> {
    const status = filters?.status;
    const where = status ? Prisma.sql`WHERE status = ${status}::"NfeImportStatus"` : Prisma.empty;
    const { skip, take } = buildPagination(pagination);

    const [rows, total] = await Promise.all([
      getDb().$queryRaw<SummaryRow[]>`
        SELECT id, "accessKey", status::text AS status,
               payload->>'number' AS number, payload->>'series' AS series,
               "issueDate", "totalAmount", "supplierDocument", "supplierName",
               jsonb_array_length(payload->'items')::int AS "itemsCount",
               "purchaseId", "createdAt"
        FROM "NfeImport" ${where}
        ORDER BY "createdAt" DESC, id DESC
        LIMIT ${take} OFFSET ${skip}`,
      getDb().nfeImport.count({ where: status ? { status } : {} }),
    ]);

    return buildPaginatedResult(
      rows.map((r) => ({
        id: r.id,
        accessKey: r.accessKey,
        status: r.status,
        number: r.number,
        series: r.series,
        issueDate: r.issueDate.toISOString().slice(0, 10),
        totalAmount: fromCents(toCents(r.totalAmount.toNumber())),
        supplier: { document: r.supplierDocument, name: r.supplierName },
        itemsCount: r.itemsCount,
        purchaseId: r.purchaseId,
        createdAt: r.createdAt,
      })),
      total,
      pagination,
    );
  }

  async getById(id: string): Promise<NfeImportRecord | null> {
    const row = await getDb().nfeImport.findUnique({
      where: { id },
      select: { id: true, accessKey: true, status: true, purchaseId: true, createdAt: true, payload: true },
    });
    if (!row) return null;
    return {
      id: row.id,
      accessKey: row.accessKey,
      status: row.status,
      purchaseId: row.purchaseId,
      createdAt: row.createdAt,
      document: row.payload as unknown as NfeDocument,
    };
  }
}
