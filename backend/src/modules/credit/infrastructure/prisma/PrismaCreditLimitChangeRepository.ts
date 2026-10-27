import { fromCents, toCents } from "@shared/domain/money";
import { getDb } from "@shared/infrastructure/prisma/transactionContext";
import type { CreditProfileCode } from "@credit/domain/CreditProfileCode";
import type { CreditChangeSource, CreditStatus } from "@credit/domain/customerCredit";
import type {
  CreditLimitChangeRecord,
  CreditLimitChangeRepository,
  NewCreditLimitChange,
} from "@credit/application/contracts/CreditLimitChangeRepository";

export class PrismaCreditLimitChangeRepository implements CreditLimitChangeRepository {
  async record(c: NewCreditLimitChange): Promise<void> {
    await getDb().creditLimitChange.create({
      data: {
        customerId: c.customerId,
        fromProfile: c.fromProfile,
        toProfile: c.toProfile,
        fromLimit: fromCents(c.fromLimitCents),
        toLimit: fromCents(c.toLimitCents),
        fromStatus: c.fromStatus,
        toStatus: c.toStatus,
        reason: c.reason,
        source: c.source,
        changedById: c.changedById,
      },
    });
  }

  async listForCustomer(customerId: string, limit: number): Promise<CreditLimitChangeRecord[]> {
    const rows = await getDb().creditLimitChange.findMany({
      where: { customerId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit,
      include: { changedBy: { select: { id: true, name: true } } },
    });
    return rows.map((r) => ({
      id: r.id,
      customerId: r.customerId,
      fromProfile: r.fromProfile as CreditProfileCode,
      toProfile: r.toProfile as CreditProfileCode,
      fromLimitCents: toCents(Number(r.fromLimit)),
      toLimitCents: toCents(Number(r.toLimit)),
      fromStatus: r.fromStatus as CreditStatus,
      toStatus: r.toStatus as CreditStatus,
      reason: r.reason,
      source: r.source as CreditChangeSource,
      changedBy: r.changedBy,
      createdAt: r.createdAt,
    }));
  }
}
