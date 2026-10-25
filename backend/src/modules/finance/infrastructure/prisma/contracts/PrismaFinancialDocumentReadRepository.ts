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
import {
  FinancialDocumentReadMapper,
  FinancialFigures,
  FinancialDocumentRow,
} from "@finance/application/mappers/FinancialDocumentReadMapper";
import { FinancialStatus } from "@finance/domain/enums/FinancialStatus";
import { FinancialType } from "@finance/domain/enums/FinancialType";
import { fromDateOnly, remainingCents, toDateOnly } from "@finance/domain/services/receivableStatus";
import { ExportTooLargeError } from "@shared/domain/errors";
import { PaginationRequest } from "@shared/application/dtos/PaginationRequest";
import { buildPaginatedResult } from "@shared/infrastructure/database/buildPaginatedResult";
import { fromCents, toCents } from "@shared/domain/money";
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

const isClosed = (row: FinancialDocumentRow, f: FinancialFigures) =>
  row.status === FinancialStatus.PAID || row.status === FinancialStatus.CANCELED || f.nextDueDate === null;

/**
 * "Com saldo": mesma regra do dashboard (restante da parcela = valor − pagamentos não
 * estornados > 0; documento não cancelado). Com intervalo, a parcela com saldo precisa
 * vencer dentro dele.
 */
function hasOpenBalance(row: FinancialDocumentRow, filters: FinancialListFilters): boolean {
  if (row.status === FinancialStatus.CANCELED) return false;
  return row.parcels.some((p) => {
    const due = toDateOnly(p.dueDate);
    if (filters.dueFrom && due < filters.dueFrom) return false;
    if (filters.dueTo && due > filters.dueTo) return false;
    const paid = p.payments.reduce((sum, pay) => (pay.reversedAt ? sum : sum + toCents(Number(pay.amount))), 0);
    return remainingCents({ amountCents: toCents(Number(p.amount)), paidCents: paid }) > 0;
  });
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
      const [suppliers, purchases] = await Promise.all([
        namesById(
          rows.map((r) => r.partyId),
          (ids) => getDb().supplier.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }),
        ),
        (async () => {
          const ids = uniqueIds(rows.map((r) => r.originId));
          if (ids.length === 0) return new Map<string, string>();
          const found = await getDb().purchase.findMany({
            where: { id: { in: ids } },
            select: { id: true, code: true },
          });
          return new Map(found.map((p) => [p.id, p.code]));
        })(),
      ]);
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
 * Lista: os filtros de banco (tipo, contraparte, intervalo de vencimento e status
 * persistido compatível) reduzem o conjunto; status de exibição (OVERDUE depende
 * de "hoje"), ordenação por próximo vencimento em aberto e resumo são calculados
 * em memória com as MESMAS regras de domínio do detalhe (receivableStatus).
 * Adequado a volumes pequenos/moderados por filtro; se crescer, migrar para SQL
 * agregado (CTE por parcela) mantendo a mesma regra.
 */
export class PrismaFinancialDocumentReadRepository implements FinancialDocumentReadRepository {
  async list<T extends FinancialType>(
    type: T,
    filters: FinancialListFilters,
    pagination: PaginationRequest,
    today: string,
  ): Promise<FinancialListResult<T>> {
    const entries = await this.loadEntries(type, filters, today);

    const totals = { open: 0, overdue: 0, paid: 0 };
    for (const { figures } of entries) {
      totals.open += figures.notDueCents;
      totals.overdue += figures.overdueCents;
      totals.paid += figures.paidCents;
    }

    const profile: TypeProfile<T> = PROFILES[type];
    const start = (pagination.page - 1) * pagination.limit;
    const page = entries.slice(start, start + pagination.limit);
    const partyOf = await profile.parties(page.map((e) => e.row));

    const result = buildPaginatedResult(
      page.map((e) => ({
        ...FinancialDocumentReadMapper.toListItemDTO(e.row, today, e.figures),
        ...partyOf(e.row),
      })),
      entries.length,
      pagination,
    );

    return { ...result, summary: profile.summary(totals) } as FinancialListResult<T>;
  }

  /**
   * Documentos do tipo que passam nos filtros da lista, já ordenados (próximo vencimento
   * em aberto; pagos/cancelados por último). Base única da lista e da exportação CSV.
   */
  private async loadEntries<T extends FinancialType>(type: T, filters: FinancialListFilters, today: string) {
    const where: Prisma.FinancialDocumentWhereInput = { type };
    if (filters.partyId) where.partyId = filters.partyId;
    if (filters.status) where.status = { in: STORED_STATUSES[filters.status] };
    if (filters.dueFrom || filters.dueTo) {
      where.parcels = {
        some: {
          dueDate: {
            ...(filters.dueFrom ? { gte: fromDateOnly(filters.dueFrom) } : {}),
            ...(filters.dueTo ? { lte: fromDateOnly(filters.dueTo) } : {}),
          },
        },
      };
    }

    const rows = await getDb().financialDocument.findMany({
      where,
      select: {
        id: true,
        status: true,
        originType: true,
        originId: true,
        partyId: true,
        createdAt: true,
        parcels: {
          select: {
            id: true,
            amount: true,
            dueDate: true,
            payments: { select: { amount: true, reversedAt: true } },
          },
        },
      },
    });

    const entries = rows
      .map((row) => ({ row, figures: FinancialDocumentReadMapper.figures(row, today) }))
      .filter((e) => !filters.openOnly || hasOpenBalance(e.row, filters))
      .filter((e) => !filters.status || e.figures.displayStatus === filters.status);

    entries.sort((a, b) => {
      const closedA = isClosed(a.row, a.figures);
      const closedB = isClosed(b.row, b.figures);
      if (closedA !== closedB) return closedA ? 1 : -1;
      if (!closedA && a.figures.nextDueDate !== b.figures.nextDueDate) {
        return a.figures.nextDueDate! < b.figures.nextDueDate! ? -1 : 1;
      }
      return a.row.createdAt.getTime() - b.row.createdAt.getTime() || a.row.id.localeCompare(b.row.id);
    });

    return entries;
  }

  async listParcelsForExport<T extends FinancialType>(
    type: T,
    filters: FinancialListFilters,
    today: string,
    maxRows: number,
  ): Promise<FinancialParcelExportRow[]> {
    const entries = await this.loadEntries(type, filters, today);
    // Com intervalo de vencimento e/ou openOnly, só as parcelas que os atendem (a lista continua por documento).
    const keep = (p: { dueDate: string; remainingAmount: number }) =>
      (!filters.dueFrom || p.dueDate >= filters.dueFrom) &&
      (!filters.dueTo || p.dueDate <= filters.dueTo) &&
      (!filters.openOnly || p.remainingAmount > 0);
    const selected = entries
      .map(({ row }) => ({ row, parcels: FinancialDocumentReadMapper.toSummaryDTO(row, today).parcels.filter(keep) }))
      .filter((e) => e.parcels.length > 0);
    if (selected.reduce((n, e) => n + e.parcels.length, 0) > maxRows) throw new ExportTooLargeError();

    const profile: TypeProfile<T> = PROFILES[type];
    const partyOf = (await profile.parties(selected.map((e) => e.row))) as (
      row: PartyKeyRow,
    ) => Partial<ReceivableParty & PayableParty>;

    return selected.flatMap(({ row, parcels }) => {
      const party = partyOf(row);
      return parcels.map((p) => ({
        documentId: row.id,
        partyName: (party.customer ?? party.supplier)?.name ?? "",
        purchaseCode: party.purchaseCode ?? null,
        originType: row.originType,
        originId: row.originId,
        number: p.number,
        dueDate: p.dueDate,
        amount: p.amount,
        paidAmount: p.paidAmount,
        remainingAmount: p.remainingAmount,
        status: p.status,
      }));
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
