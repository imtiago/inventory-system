import { Prisma } from "@prisma/client";
import { ConflictError, ErrorCodes, InternalErrorCodes, InternalInvariantError } from "@shared/domain/errors";
import { PaginatedResult } from "@shared/application/dtos/PaginatedResult";
import { PaginationRequest } from "@shared/application/dtos/PaginationRequest";
import { fromCents, toCents } from "@shared/domain/money";
import { buildPaginatedResult } from "@shared/infrastructure/database/buildPaginatedResult";
import { buildPagination } from "@shared/infrastructure/database/buildPagination";
import { readTogether } from "@shared/infrastructure/database/readTogether";
import { getDb, hasActiveTransaction } from "@shared/infrastructure/prisma/transactionContext";
import { SaleCancelRequestDTO } from "@sales/application/dto/SaleCancelRequestDTO";
import { ApprovalRequestStatus, SaleCancelRequest } from "@sales/domain/entities/SaleCancelRequest";
import { SaleCancelRequestRepository } from "@sales/domain/repositories/SaleCancelRequestRepository";

const personSelect = { select: { id: true, name: true } } as const;
const dtoInclude = {
  requestedBy: personSelect,
  decidedBy: personSelect,
  sale: { select: { totalAmount: true, customer: { select: { name: true } } } },
} as const;

type Row = Prisma.SaleCancelRequestGetPayload<{ include: typeof dtoInclude }>;

const toDTO = (row: Row): SaleCancelRequestDTO => ({
  id: row.id,
  saleId: row.saleId,
  customerName: row.sale.customer.name,
  total: fromCents(toCents(Number(row.sale.totalAmount))),
  reason: row.reason,
  status: row.status,
  requestedBy: row.requestedBy,
  requestedAt: row.requestedAt,
  decidedBy: row.decidedBy,
  decidedAt: row.decidedAt,
  decisionReason: row.decisionReason,
});

function requireTransaction() {
  if (!hasActiveTransaction()) {
    throw new InternalInvariantError(
      "Trava de pedido de cancelamento exige transação ativa.",
      InternalErrorCodes.LOCK_OUTSIDE_TRANSACTION,
    );
  }
}

export class PrismaSaleCancelRequestRepository implements SaleCancelRequestRepository {
  async create(input: { saleId: string; reason: string; requestedById: string }): Promise<string> {
    try {
      const row = await getDb().saleCancelRequest.create({ data: input, select: { id: true } });
      return row.id;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictError(
          "Já existe um pedido de cancelamento em aberto para esta venda.",
          ErrorCodes.CANCEL_REQUEST_ALREADY_PENDING,
        );
      }
      throw error;
    }
  }

  async lockById(id: string): Promise<SaleCancelRequest | null> {
    requireTransaction();
    const rows = await getDb().$queryRaw<{ id: string }[]>`
      SELECT id FROM "SaleCancelRequest" WHERE id = ${id} FOR UPDATE`;
    if (rows.length === 0) return null;
    const row = await getDb().saleCancelRequest.findUniqueOrThrow({ where: { id } });
    return new SaleCancelRequest(row);
  }

  async lockPendingBySaleId(saleId: string): Promise<void> {
    requireTransaction();
    await getDb().$queryRaw`
      SELECT id FROM "SaleCancelRequest" WHERE "saleId" = ${saleId} AND status = 'PENDING' FOR UPDATE`;
  }

  async hasPendingForSale(saleId: string): Promise<boolean> {
    return (await getDb().saleCancelRequest.count({ where: { saleId, status: "PENDING" } })) > 0;
  }

  async saleHasActivePayments(saleId: string): Promise<boolean> {
    const count = await getDb().payment.count({
      where: {
        reversedAt: null,
        parcel: { document: { originType: "SALE", originId: saleId } },
      },
    });
    return count > 0;
  }

  async saveDecision(request: SaleCancelRequest): Promise<void> {
    const p = request.toProps();
    await getDb().saleCancelRequest.update({
      where: { id: p.id },
      data: { status: p.status, decidedById: p.decidedById, decidedAt: p.decidedAt, decisionReason: p.decisionReason },
    });
  }

  async approvePendingForSale(saleId: string, decidedById: string | undefined): Promise<void> {
    await getDb().saleCancelRequest.updateMany({
      where: { saleId, status: "PENDING" },
      data: { status: "APPROVED", decidedById: decidedById ?? null, decidedAt: new Date() },
    });
  }

  async findDtoById(id: string): Promise<SaleCancelRequestDTO | null> {
    const row = await getDb().saleCancelRequest.findUnique({ where: { id }, include: dtoInclude });
    return row ? toDTO(row) : null;
  }

  async list(
    pagination: PaginationRequest,
    filter: { status?: ApprovalRequestStatus },
  ): Promise<PaginatedResult<SaleCancelRequestDTO>> {
    const where: Prisma.SaleCancelRequestWhereInput = filter.status ? { status: filter.status } : {};
    const [rows, total] = await readTogether([
      getDb().saleCancelRequest.findMany({
        ...buildPagination(pagination),
        where,
        include: dtoInclude,
        orderBy: [{ requestedAt: "desc" }, { id: "asc" }],
      }),
      getDb().saleCancelRequest.count({ where }),
    ]);
    return buildPaginatedResult(rows.map(toDTO), total, pagination);
  }

  async countPending(): Promise<number> {
    return getDb().saleCancelRequest.count({ where: { status: "PENDING" } });
  }
}
