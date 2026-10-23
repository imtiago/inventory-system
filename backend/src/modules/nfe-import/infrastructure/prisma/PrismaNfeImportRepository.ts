import { Prisma } from "@prisma/client";
import { InternalErrorCodes, InternalInvariantError } from "@shared/domain/errors";
import { getDb, hasActiveTransaction } from "@shared/infrastructure/prisma/transactionContext";
import { NfeDocument } from "@nfe-import/domain/NfeDocument";
import {
  LockedNfeImport,
  NfeImportAccessKeyTaken,
  NfeImportRepository,
} from "@nfe-import/application/contracts/NfeImportRepository";

function assertInTransaction() {
  if (!hasActiveTransaction()) {
    throw new InternalInvariantError(
      "Trava de importação de NF-e exige transação ativa.",
      InternalErrorCodes.LOCK_OUTSIDE_TRANSACTION,
    );
  }
}

/** Colunas desnormalizadas (lista/filtros) + o documento lido inteiro em `payload`. */
function contentOf(document: NfeDocument) {
  return {
    supplierDocument: document.supplier.document,
    supplierName: document.supplier.name,
    issueDate: new Date(`${document.issueDate}T00:00:00.000Z`),
    totalAmount: new Prisma.Decimal(document.totals.total).div(100),
    payload: document as unknown as Prisma.InputJsonValue,
  };
}

function isAccessKeyConflict(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return false;
  const target = (error.meta as { target?: unknown } | undefined)?.target;
  return Array.isArray(target) ? target.includes("accessKey") : String(target ?? "").includes("accessKey");
}

export class PrismaNfeImportRepository implements NfeImportRepository {
  async lockByAccessKey(accessKey: string): Promise<LockedNfeImport | null> {
    assertInTransaction();
    const rows = await getDb().$queryRaw<LockedNfeImport[]>`
      SELECT n.id, n.status::text AS status, n."purchaseId", p.status::text AS "purchaseStatus"
      FROM "NfeImport" n LEFT JOIN "Purchase" p ON p.id = n."purchaseId"
      WHERE n."accessKey" = ${accessKey} FOR UPDATE OF n`;
    return rows[0] ?? null;
  }

  async lockById(id: string): Promise<LockedNfeImport | null> {
    assertInTransaction();
    const rows = await getDb().$queryRaw<LockedNfeImport[]>`
      SELECT n.id, n.status::text AS status, n."purchaseId", p.status::text AS "purchaseStatus"
      FROM "NfeImport" n LEFT JOIN "Purchase" p ON p.id = n."purchaseId"
      WHERE n.id = ${id} FOR UPDATE OF n`;
    return rows[0] ?? null;
  }

  async createDraft(document: NfeDocument, createdById: string | null): Promise<string> {
    try {
      const row = await getDb().nfeImport.create({
        data: { accessKey: document.accessKey, status: "DRAFT", createdById, ...contentOf(document) },
        select: { id: true },
      });
      return row.id;
    } catch (e) {
      if (isAccessKeyConflict(e)) throw new NfeImportAccessKeyTaken();
      throw e;
    }
  }

  async replaceDraftContent(id: string, document: NfeDocument): Promise<void> {
    await getDb().nfeImport.update({ where: { id }, data: contentOf(document) });
  }

  async resetToDraft(id: string, document: NfeDocument): Promise<void> {
    await getDb().nfeImport.update({
      where: { id },
      data: { status: "DRAFT", purchaseId: null, confirmedById: null, confirmedAt: null, ...contentOf(document) },
    });
  }

  async findDocument(id: string): Promise<NfeDocument | null> {
    const row = await getDb().nfeImport.findUnique({ where: { id }, select: { payload: true } });
    return row ? (row.payload as unknown as NfeDocument) : null;
  }

  async markConfirmed({ id, purchaseId, confirmedById }: { id: string; purchaseId: string; confirmedById: string }) {
    await getDb().nfeImport.update({
      where: { id },
      data: { status: "CONFIRMED", purchaseId, confirmedById, confirmedAt: new Date() },
    });
  }

  async delete(id: string): Promise<void> {
    await getDb().nfeImport.delete({ where: { id } });
  }
}
