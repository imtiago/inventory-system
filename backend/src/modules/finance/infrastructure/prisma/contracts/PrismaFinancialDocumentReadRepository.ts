import { Prisma } from "@prisma/client";
import { FinancialDocumentReadRepository } from "@finance/application/contracts/FinancialDocumentReadRepository";
import {
  PersonRefDTO,
  ReceivableDetailDTO,
  ReceivableListFilters,
  ReceivableListResult,
} from "@finance/application/dto/ReceivableReadDTO";
import {
  FinancialDocumentReadMapper,
  ReceivableFigures,
  ReceivableRow,
} from "@finance/application/mappers/FinancialDocumentReadMapper";
import { FinancialStatus } from "@finance/domain/enums/FinancialStatus";
import { fromDateOnly } from "@finance/domain/services/receivableStatus";
import { PaginationRequest } from "@shared/application/dtos/PaginationRequest";
import { buildPaginatedResult } from "@shared/infrastructure/database/buildPaginatedResult";
import { fromCents } from "@shared/domain/money";
import { getDb } from "@shared/infrastructure/prisma/transactionContext";

const personSelect = { select: { id: true, name: true } } as const;

/** Status persistidos compatíveis com cada filtro (refinado depois pelo displayStatus). */
const STORED_STATUSES: Record<NonNullable<ReceivableListFilters["status"]>, FinancialStatus[]> = {
  OPEN: [FinancialStatus.OPEN],
  PARTIALLY_PAID: [FinancialStatus.PARTIALLY_PAID],
  PAID: [FinancialStatus.PAID],
  CANCELED: [FinancialStatus.CANCELED],
  OVERDUE: [FinancialStatus.OPEN, FinancialStatus.PARTIALLY_PAID],
};

const isClosed = (row: ReceivableRow, f: ReceivableFigures) =>
  row.status === FinancialStatus.PAID || row.status === FinancialStatus.CANCELED || f.nextDueDate === null;

/**
 * Leitura de contas a receber.
 *
 * Lista: os filtros de banco (tipo, cliente, intervalo de vencimento e status
 * persistido compatível) reduzem o conjunto; status de exibição (OVERDUE depende
 * de "hoje"), ordenação por próximo vencimento em aberto e resumo são calculados
 * em memória com as MESMAS regras de domínio do detalhe (receivableStatus).
 * Adequado a volumes pequenos/moderados por filtro; se crescer, migrar para SQL
 * agregado (CTE por parcela) mantendo a mesma regra.
 */
export class PrismaFinancialDocumentReadRepository implements FinancialDocumentReadRepository {
  async listReceivables(
    filters: ReceivableListFilters,
    pagination: PaginationRequest,
    today: string,
  ): Promise<ReceivableListResult> {
    const where: Prisma.FinancialDocumentWhereInput = { type: "RECEIVABLE" };
    if (filters.customerId) where.partyId = filters.customerId;
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

    let openCents = 0;
    let overdueCents = 0;
    let receivedCents = 0;
    for (const { figures } of entries) {
      openCents += figures.notDueCents;
      overdueCents += figures.overdueCents;
      receivedCents += figures.paidCents;
    }

    const start = (pagination.page - 1) * pagination.limit;
    const page = entries.slice(start, start + pagination.limit);
    const customers = await this.customersById(page.map((e) => e.row.partyId));

    const result = buildPaginatedResult(
      page.map((e) =>
        FinancialDocumentReadMapper.toListItemDTO(e.row, customers.get(e.row.partyId), today, e.figures),
      ),
      entries.length,
      pagination,
    );

    return {
      ...result,
      summary: {
        openAmount: fromCents(openCents),
        overdueAmount: fromCents(overdueCents),
        receivedAmount: fromCents(receivedCents),
      },
    };
  }

  async getReceivableById(id: string, today: string): Promise<ReceivableDetailDTO | null> {
    const row = await getDb().financialDocument.findFirst({
      where: { id, type: "RECEIVABLE" },
      include: {
        parcels: {
          include: {
            payments: { include: { createdBy: personSelect, reversedBy: personSelect } },
          },
        },
      },
    });
    if (!row) return null;

    const customers = await this.customersById([row.partyId]);
    return FinancialDocumentReadMapper.toDetailDTO(row, customers.get(row.partyId), today);
  }

  /** Clientes (partyId de recebíveis) em uma única consulta — não há FK. */
  private async customersById(ids: string[]): Promise<Map<string, PersonRefDTO>> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return new Map();
    const customers = await getDb().customer.findMany({
      where: { id: { in: unique } },
      select: { id: true, name: true },
    });
    return new Map(customers.map((c) => [c.id, c]));
  }
}
