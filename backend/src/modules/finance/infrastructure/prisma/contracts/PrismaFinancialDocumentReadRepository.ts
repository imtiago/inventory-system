import { Prisma } from "@prisma/client";
import { FinancialDocumentReadRepository } from "@finance/application/contracts/FinancialDocumentReadRepository";
import {
  FinancialDocumentDetailDTO,
  FinancialListFilters,
  FinancialListResult,
  FinancialParcelExportRow,
  FinancialReadDTOs,
  PayableParty,
  PersonRefDTO,
  ReceivableParty,
} from "@finance/application/dto/FinancialDocumentReadDTO";
import { FinancialDocumentReadMapper } from "@finance/application/mappers/FinancialDocumentReadMapper";
import { FinancialStatus } from "@finance/domain/enums/FinancialStatus";
import { FinancialType } from "@finance/domain/enums/FinancialType";
import { parcelStatus } from "@finance/domain/services/receivableStatus";
import { ExportTooLargeError } from "@shared/domain/errors";
import { PaginationRequest } from "@shared/application/dtos/PaginationRequest";
import { buildPaginatedResult } from "@shared/infrastructure/database/buildPaginatedResult";
import { fromCents } from "@shared/domain/money";
import { getDb } from "@shared/infrastructure/prisma/transactionContext";

const personSelect = { select: { id: true, name: true } } as const;

/** Status persistidos compatíveis com cada filtro (refinado depois pelo displayStatus). */
const STORED_STATUSES: Record<NonNullable<FinancialListFilters["status"]>, FinancialStatus[]> = {
  OPEN: [FinancialStatus.OPEN],
  PARTIALLY_PAID: [FinancialStatus.PARTIALLY_PAID],
  PAID: [FinancialStatus.PAID],
  CANCELED: [FinancialStatus.CANCELED],
  OVERDUE: [FinancialStatus.OPEN, FinancialStatus.PARTIALLY_PAID],
};

/** Valores em centavos vêm como bigint do Postgres. */
const num = (v: bigint | number) => Number(v);

/** Documento com os valores derivados calculados no banco (centavos). */
interface FigureRow {
  id: string;
  status: string;
  displayStatus: string;
  originType: string;
  originId: string;
  partyId: string;
  createdAt: Date;
  totalCents: bigint;
  paidCents: bigint;
  remainingCents: bigint;
  nextDueDate: string | null;
  parcelsCount: number;
}

interface ListRow extends Partial<FigureRow> {
  total: number;
  openSum: bigint;
  overdueSum: bigint;
  paidSum: bigint;
}

interface ExportRow {
  documentId: string;
  documentStatus: string;
  originType: string;
  originId: string;
  partyId: string;
  number: bigint;
  dueDate: string;
  amountCents: bigint;
  paidCents: bigint;
  remainingCents: bigint;
}

/**
 * Ordem da lista e da exportação: documentos com saldo primeiro, pelo próximo vencimento
 * em aberto; pagos/cancelados/quitados por último; desempate por criação e id.
 */
const DOCUMENT_ORDER = Prisma.sql`
  (f.status IN ('PAID', 'CANCELED') OR f.next_due IS NULL),
  CASE WHEN f.status IN ('PAID', 'CANCELED') THEN NULL ELSE f.next_due END,
  f."createdAt",
  f.id COLLATE "C"`;

/**
 * CTEs `parcel` (uma linha por parcela dos documentos pré-filtrados, com pago e restante
 * em centavos) e `filtered` (documentos que passam em todos os filtros, com os valores
 * derivados). Regras idênticas às do domínio (receivableStatus) e do dashboard:
 * restante = max(valor − Σ pagamentos não estornados, 0); "vencido" = vencimento < hoje
 * (data de negócio). Todos os valores do usuário entram como parâmetros.
 */
function filteredDocumentsCte(type: FinancialType, filters: FinancialListFilters, today: string): Prisma.Sql {
  const docWhere: Prisma.Sql[] = [Prisma.sql`fd.type = ${type}::"FinancialType"`];
  if (filters.partyId) docWhere.push(Prisma.sql`fd."partyId" = ${filters.partyId}`);
  if (filters.status) {
    const statuses = STORED_STATUSES[filters.status].map((s) => Prisma.sql`${s}::"FinancialStatus"`);
    docWhere.push(Prisma.sql`fd.status IN (${Prisma.join(statuses)})`);
  }
  if (filters.dueFrom || filters.dueTo) {
    // Qualquer parcela no intervalo (meia-noite UTC, convenção de datas sem hora).
    docWhere.push(Prisma.sql`EXISTS (
      SELECT 1 FROM "FinancialParcel" r
      WHERE r."financialDocumentId" = fd.id
        ${filters.dueFrom ? Prisma.sql`AND r."dueDate" >= ${filters.dueFrom}::date` : Prisma.empty}
        ${filters.dueTo ? Prisma.sql`AND r."dueDate" <= ${filters.dueTo}::date` : Prisma.empty})`);
  }

  // openOnly: não cancelado e alguma parcela com saldo (dentro do intervalo, se houver).
  const inRange = Prisma.sql`pa.remaining_c > 0
    ${filters.dueFrom ? Prisma.sql`AND pa.due >= ${filters.dueFrom}::date` : Prisma.empty}
    ${filters.dueTo ? Prisma.sql`AND pa.due <= ${filters.dueTo}::date` : Prisma.empty}`;
  // Resumo: com intervalo, só as parcelas dentro dele (mesma regra da exportação); sem, todas.
  const dueInRange = Prisma.sql`TRUE
    ${filters.dueFrom ? Prisma.sql`AND pa.due >= ${filters.dueFrom}::date` : Prisma.empty}
    ${filters.dueTo ? Prisma.sql`AND pa.due <= ${filters.dueTo}::date` : Prisma.empty}`;
  const figWhere: Prisma.Sql[] = [Prisma.sql`TRUE`];
  if (filters.openOnly) figWhere.push(Prisma.sql`f.status <> 'CANCELED' AND f.open_in_range`);
  if (filters.status) figWhere.push(Prisma.sql`f.display_status = ${filters.status}`);

  return Prisma.sql`
    doc AS (
      SELECT fd.id, fd.status, fd."originType", fd."originId", fd."partyId", fd."createdAt"
      FROM "FinancialDocument" fd
      WHERE ${Prisma.join(docWhere, " AND ")}
    ),
    parcel AS (
      SELECT fp."financialDocumentId" AS doc_id, fp.id, fp."dueDate" AS due_at, fp."dueDate"::date AS due,
             (fp.amount * 100)::bigint AS amount_c,
             COALESCE(pay.paid_c, 0)::bigint AS paid_c,
             GREATEST((fp.amount * 100)::bigint - COALESCE(pay.paid_c, 0), 0)::bigint AS remaining_c
      FROM doc
      JOIN "FinancialParcel" fp ON fp."financialDocumentId" = doc.id
      LEFT JOIN LATERAL (
        SELECT (SUM(p.amount) * 100)::bigint AS paid_c
        FROM "Payment" p
        WHERE p."parcelId" = fp.id AND p."reversedAt" IS NULL
      ) pay ON TRUE
    ),
    fig AS (
      SELECT doc.id, doc.status, doc."originType", doc."originId", doc."partyId", doc."createdAt",
             COUNT(pa.id)::int AS parcels_count,
             COALESCE(SUM(pa.amount_c), 0)::bigint AS total_c,
             COALESCE(SUM(pa.paid_c), 0)::bigint AS paid_c,
             COALESCE(SUM(pa.remaining_c), 0)::bigint AS remaining_c,
             CASE WHEN doc.status = 'CANCELED' THEN 0
                  ELSE COALESCE(SUM(pa.remaining_c) FILTER (WHERE pa.due < ${today}::date AND ${dueInRange}), 0) END::bigint AS sum_overdue_c,
             CASE WHEN doc.status = 'CANCELED' THEN 0
                  ELSE COALESCE(SUM(pa.remaining_c) FILTER (WHERE pa.due >= ${today}::date AND ${dueInRange}), 0) END::bigint AS sum_not_due_c,
             COALESCE(SUM(pa.paid_c) FILTER (WHERE ${dueInRange}), 0)::bigint AS sum_paid_c,
             CASE WHEN doc.status = 'CANCELED' THEN NULL
                  ELSE MIN(pa.due) FILTER (WHERE pa.remaining_c > 0) END AS next_due,
             CASE WHEN doc.status IN ('CANCELED', 'PAID') THEN doc.status::text
                  WHEN bool_or(pa.remaining_c > 0 AND pa.due < ${today}::date) THEN 'OVERDUE'
                  ELSE doc.status::text END AS display_status,
             COALESCE(bool_or(${inRange}), FALSE) AS open_in_range
      FROM doc
      LEFT JOIN parcel pa ON pa.doc_id = doc.id
      GROUP BY doc.id, doc.status, doc."originType", doc."originId", doc."partyId", doc."createdAt"
    ),
    filtered AS (
      SELECT f.* FROM fig f WHERE ${Prisma.join(figWhere, " AND ")}
    )`;
}

/** Linha mínima para juntar a contraparte e a origem (não há FK de partyId/originId). */
interface PartyKeyRow {
  partyId: string;
  originId: string;
}

/** O que muda entre os tipos: contraparte (e código do pedido) e o nome do total pago no resumo. */
interface TypeProfile<T extends FinancialType> {
  /** Carrega as contrapartes das linhas em lote e devolve os campos de cada uma. */
  parties(rows: PartyKeyRow[]): Promise<(row: PartyKeyRow) => PartyFieldsByType[T]>;
  summary(cents: { open: number; overdue: number; paid: number }): FinancialReadDTOs[T]["summary"];
}

interface PartyFieldsByType {
  [FinancialType.RECEIVABLE]: ReceivableParty;
  [FinancialType.PAYABLE]: PayableParty;
}

const uniqueIds = (ids: string[]) => [...new Set(ids)];

async function namesById(
  ids: string[],
  find: (ids: string[]) => Promise<PersonRefDTO[]>,
): Promise<Map<string, PersonRefDTO>> {
  const unique = uniqueIds(ids);
  if (unique.length === 0) return new Map();
  return new Map((await find(unique)).map((p) => [p.id, p]));
}

const PROFILES: { [T in FinancialType]: TypeProfile<T> } = {
  [FinancialType.RECEIVABLE]: {
    async parties(rows) {
      const customers = await namesById(
        rows.map((r) => r.partyId),
        (ids) => getDb().customer.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }),
      );
      return (row) => ({
        customer: FinancialDocumentReadMapper.party(row.partyId, customers.get(row.partyId), "Cliente não encontrado"),
      });
    },
    summary: (c) => ({
      openAmount: fromCents(c.open),
      overdueAmount: fromCents(c.overdue),
      receivedAmount: fromCents(c.paid),
    }),
  },
  [FinancialType.PAYABLE]: {
    async parties(rows) {
      // Em sequência (mesma conexão), não em paralelo.
      const suppliers = await namesById(
        rows.map((r) => r.partyId),
        (ids) => getDb().supplier.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }),
      );
      const purchaseIds = uniqueIds(rows.map((r) => r.originId));
      const purchases = new Map<string, string>();
      if (purchaseIds.length > 0) {
        const found = await getDb().purchase.findMany({
          where: { id: { in: purchaseIds } },
          select: { id: true, code: true },
        });
        for (const p of found) purchases.set(p.id, p.code);
      }
      return (row) => ({
        supplier: FinancialDocumentReadMapper.party(
          row.partyId,
          suppliers.get(row.partyId),
          "Fornecedor não encontrado",
        ),
        purchaseCode: purchases.get(row.originId) ?? "",
      });
    },
    summary: (c) => ({
      openAmount: fromCents(c.open),
      overdueAmount: fromCents(c.overdue),
      paidAmount: fromCents(c.paid),
    }),
  },
};

/**
 * Leitura de contas a receber e a pagar, sempre restrita ao `type` pedido.
 *
 * Lista, resumo e exportação são calculados no banco (filteredDocumentsCte): status de
 * exibição, restante, próximo vencimento, filtros, ordenação, paginação e resumo, com as
 * MESMAS regras de domínio do detalhe (receivableStatus). Só a página (ou as linhas da
 * exportação, no máximo `maxRows + 1`) sai do banco; as contrapartes são buscadas em lote.
 */
export class PrismaFinancialDocumentReadRepository implements FinancialDocumentReadRepository {
  async list<T extends FinancialType>(
    type: T,
    filters: FinancialListFilters,
    pagination: PaginationRequest,
    today: string,
  ): Promise<FinancialListResult<T>> {
    const offset = (pagination.page - 1) * pagination.limit;
    const rows = await getDb().$queryRaw<ListRow[]>(Prisma.sql`
      WITH ${filteredDocumentsCte(type, filters, today)},
      totals AS (
        SELECT COUNT(*)::int AS total,
               COALESCE(SUM(f.sum_not_due_c), 0)::bigint AS open_sum,
               COALESCE(SUM(f.sum_overdue_c), 0)::bigint AS overdue_sum,
               COALESCE(SUM(f.sum_paid_c), 0)::bigint AS paid_sum
        FROM filtered f
      ),
      page AS (
        SELECT f.*, ROW_NUMBER() OVER (ORDER BY ${DOCUMENT_ORDER}) AS rn
        FROM filtered f
        ORDER BY ${DOCUMENT_ORDER}
        LIMIT ${pagination.limit} OFFSET ${offset}
      )
      SELECT t.total, t.open_sum AS "openSum", t.overdue_sum AS "overdueSum", t.paid_sum AS "paidSum",
             p.id, p.status::text AS status, p.display_status AS "displayStatus",
             p."originType"::text AS "originType", p."originId", p."partyId", p."createdAt",
             p.total_c AS "totalCents", p.paid_c AS "paidCents", p.remaining_c AS "remainingCents",
             to_char(p.next_due, 'YYYY-MM-DD') AS "nextDueDate", p.parcels_count AS "parcelsCount"
      FROM totals t
      LEFT JOIN page p ON TRUE
      ORDER BY p.rn`);

    const totals = rows[0];
    const items = rows.filter((r): r is ListRow & FigureRow => r.id != null);

    const profile: TypeProfile<T> = PROFILES[type];
    const partyOf = await profile.parties(items);

    const result = buildPaginatedResult(
      items.map((r) => ({
        id: r.id,
        status: r.status,
        displayStatus: r.displayStatus,
        originType: r.originType,
        originId: r.originId,
        totalAmount: fromCents(num(r.totalCents)),
        paidAmount: fromCents(num(r.paidCents)),
        remainingAmount: fromCents(num(r.remainingCents)),
        nextDueDate: r.nextDueDate,
        parcelsCount: r.parcelsCount,
        createdAt: r.createdAt,
        ...partyOf(r),
      })),
      totals.total,
      pagination,
    );

    const summary = profile.summary({
      open: num(totals.openSum),
      overdue: num(totals.overdueSum),
      paid: num(totals.paidSum),
    });
    return { ...result, summary } as FinancialListResult<T>;
  }

  async listParcelsForExport<T extends FinancialType>(
    type: T,
    filters: FinancialListFilters,
    today: string,
    maxRows: number,
  ): Promise<FinancialParcelExportRow[]> {
    // Com intervalo de vencimento e/ou openOnly, só as parcelas que os atendem (a lista continua por documento).
    // A numeração considera todas as parcelas do documento (por vencimento, desempate por id).
    const keep: Prisma.Sql[] = [Prisma.sql`TRUE`];
    if (filters.dueFrom) keep.push(Prisma.sql`n.due >= ${filters.dueFrom}::date`);
    if (filters.dueTo) keep.push(Prisma.sql`n.due <= ${filters.dueTo}::date`);
    if (filters.openOnly) keep.push(Prisma.sql`n.remaining_c > 0`);

    const rows = await getDb().$queryRaw<ExportRow[]>(Prisma.sql`
      WITH ${filteredDocumentsCte(type, filters, today)},
      ranked AS (
        SELECT f.*, ROW_NUMBER() OVER (ORDER BY ${DOCUMENT_ORDER}) AS doc_rank
        FROM filtered f
      ),
      numbered AS (
        SELECT pa.*, ROW_NUMBER() OVER (PARTITION BY pa.doc_id ORDER BY pa.due_at, pa.id COLLATE "C") AS number
        FROM parcel pa
      )
      SELECT r.id AS "documentId", r.status::text AS "documentStatus", r."originType"::text AS "originType",
             r."originId", r."partyId", n.number, to_char(n.due, 'YYYY-MM-DD') AS "dueDate",
             n.amount_c AS "amountCents", n.paid_c AS "paidCents", n.remaining_c AS "remainingCents"
      FROM ranked r
      JOIN numbered n ON n.doc_id = r.id
      WHERE ${Prisma.join(keep, " AND ")}
      ORDER BY r.doc_rank, n.number
      LIMIT ${maxRows + 1}`);
    if (rows.length > maxRows) throw new ExportTooLargeError();

    const profile: TypeProfile<T> = PROFILES[type];
    const partyOf = (await profile.parties(
      rows.map((r) => ({ partyId: r.partyId, originId: r.originId })),
    )) as (row: PartyKeyRow) => Partial<ReceivableParty & PayableParty>;

    return rows.map((r) => {
      const party = partyOf(r);
      const amountCents = num(r.amountCents);
      const paidCents = num(r.paidCents);
      return {
        documentId: r.documentId,
        partyName: (party.customer ?? party.supplier)?.name ?? "",
        purchaseCode: party.purchaseCode ?? null,
        originType: r.originType,
        originId: r.originId,
        number: num(r.number),
        dueDate: r.dueDate,
        amount: fromCents(amountCents),
        paidAmount: fromCents(paidCents),
        remainingAmount: fromCents(num(r.remainingCents)),
        status: parcelStatus({ amountCents, paidCents, dueDate: r.dueDate, documentStatus: r.documentStatus }, today),
      };
    });
  }

  async getById<T extends FinancialType>(
    type: T,
    id: string,
    today: string,
  ): Promise<FinancialDocumentDetailDTO<T> | null> {
    const row = await getDb().financialDocument.findFirst({
      where: { id, type },
      include: {
        parcels: {
          include: {
            payments: { include: { createdBy: personSelect, reversedBy: personSelect } },
          },
        },
      },
    });
    if (!row) return null;

    const partyOf = await (PROFILES[type] as TypeProfile<T>).parties([row]);
    return {
      ...FinancialDocumentReadMapper.toDetailDTO(row, today),
      ...partyOf(row),
    } as FinancialDocumentDetailDTO<T>;
  }
}
