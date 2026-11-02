import { Prisma } from "@prisma/client";
import { ConflictError, ErrorCodes, InternalErrorCodes, InternalInvariantError } from "@shared/domain/errors";
import type { PaginatedResult } from "@shared/application/dtos/PaginatedResult";
import type { PaginationRequest } from "@shared/application/dtos/PaginationRequest";
import { fromCents, toCents } from "@shared/domain/money";
import { buildPaginatedResult } from "@shared/infrastructure/database/buildPaginatedResult";
import { buildPagination } from "@shared/infrastructure/database/buildPagination";
import { readTogether } from "@shared/infrastructure/database/readTogether";
import { getDb, hasActiveTransaction } from "@shared/infrastructure/prisma/transactionContext";
import { CreditLimitRequest, type CreditRequestStatus } from "@credit/domain/creditLimitRequest";
import type { CreditLimitRequestRepository } from "@credit/application/contracts/CreditLimitRequestRepository";
import type { CreditLimitRequestDTO } from "@credit/application/dto/CreditLimitRequestDTO";

const personSelect = { select: { id: true, name: true } } as const;
const dtoInclude = { customer: personSelect, requestedBy: personSelect, decidedBy: personSelect } as const;
type Row = Prisma.CreditLimitRequestGetPayload<{ include: typeof dtoInclude }>;

const money = (v: Prisma.Decimal) => fromCents(toCents(Number(v)));

const toDTO = (row: Row): CreditLimitRequestDTO => ({
  id: row.id,
  customer: row.customer,
  currentLimit: money(row.currentLimit),
  requestedLimit: money(row.requestedLimit),
  approvedLimit: row.approvedLimit === null ? null : money(row.approvedLimit),
  reason: row.reason,
  status: row.status,
  autoApproved: row.autoApproved,
  requestedBy: row.requestedBy,
  requestedAt: row.requestedAt,
  decidedBy: row.decidedBy,
  decidedAt: row.decidedAt,
  decisionReason: row.decisionReason,
});

export class PrismaCreditLimitRequestRepository implements CreditLimitRequestRepository {
  async create(input: Parameters<CreditLimitRequestRepository["create"]>[0]): Promise<string> {
    const now = new Date();
    try {
      const row = await getDb().creditLimitRequest.create({
        data: {
          customerId: input.customerId,
          currentLimit: fromCents(input.currentLimitCents),
          requestedLimit: fromCents(input.requestedLimitCents),
          reason: input.reason,
          requestedById: input.requestedById,
          autoApproved: input.autoApproved,
          ...(input.autoApproved
            ? { status: "APPROVED", approvedLimit: fromCents(input.requestedLimitCents), decidedAt: now, decisionReason: "Aprovação automática" }
            : {}),
        },
        select: { id: true },
      });
      return row.id;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictError("Já existe um pedido de aumento em aberto para este cliente.", ErrorCodes.CREDIT_REQUEST_ALREADY_PENDING);
      }
      throw error;
    }
  }

  async lockById(id: string): Promise<CreditLimitRequest | null> {
    if (!hasActiveTransaction()) {
      throw new InternalInvariantError("Trava de pedido de aumento exige transação ativa.", InternalErrorCodes.LOCK_OUTSIDE_TRANSACTION);
    }
    const rows = await getDb().$queryRaw<{ id: string }[]>`SELECT id FROM "CreditLimitRequest" WHERE id = ${id} FOR UPDATE`;
    if (rows.length === 0) return null;
    const row = await getDb().creditLimitRequest.findUniqueOrThrow({ where: { id } });
    return new CreditLimitRequest({
      id: row.id,
      customerId: row.customerId,
      currentLimitCents: toCents(Number(row.currentLimit)),
      requestedLimitCents: toCents(Number(row.requestedLimit)),
      approvedLimitCents: row.approvedLimit === null ? null : toCents(Number(row.approvedLimit)),
      reason: row.reason,
      status: row.status,
      autoApproved: row.autoApproved,
      requestedById: row.requestedById,
      requestedAt: row.requestedAt,
      decidedById: row.decidedById,
      decidedAt: row.decidedAt,
      decisionReason: row.decisionReason,
    });
  }

  async hasPendingForCustomer(customerId: string): Promise<boolean> {
    return (await getDb().creditLimitRequest.count({ where: { customerId, status: "PENDING" } })) > 0;
  }

  async saveDecision(request: CreditLimitRequest): Promise<void> {
    const p = request.toProps();
    await getDb().creditLimitRequest.update({
      where: { id: p.id },
      data: {
        status: p.status,
        approvedLimit: p.approvedLimitCents === null ? null : fromCents(p.approvedLimitCents),
        decidedById: p.decidedById,
        decidedAt: p.decidedAt,
        decisionReason: p.decisionReason,
      },
    });
  }

  async findDtoById(id: string): Promise<CreditLimitRequestDTO | null> {
    const row = await getDb().creditLimitRequest.findUnique({ where: { id }, include: dtoInclude });
    return row ? toDTO(row) : null;
  }

  async list(pagination: PaginationRequest, filter: { status?: CreditRequestStatus }): Promise<PaginatedResult<CreditLimitRequestDTO>> {
    const where: Prisma.CreditLimitRequestWhereInput = filter.status ? { status: filter.status } : {};
    const [rows, total] = await readTogether([
      getDb().creditLimitRequest.findMany({
        ...buildPagination(pagination),
        where,
        include: dtoInclude,
        orderBy: [{ requestedAt: "desc" }, { id: "asc" }],
      }),
      getDb().creditLimitRequest.count({ where }),
    ]);
    return buildPaginatedResult(rows.map(toDTO), total, pagination);
  }

  async countPending(): Promise<number> {
    return getDb().creditLimitRequest.count({ where: { status: "PENDING" } });
  }
}
