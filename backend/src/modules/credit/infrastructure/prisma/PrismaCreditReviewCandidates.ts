import { Prisma } from "@prisma/client";
import { toCents } from "@shared/domain/money";
import { getDb } from "@shared/infrastructure/prisma/transactionContext";
import type { CreditProfileCode } from "@credit/domain/CreditProfileCode";
import type { CreditStatus } from "@credit/domain/customerCredit";
import type { CreditReviewCandidate, CreditReviewCandidates } from "@credit/application/contracts/CreditReviewCandidates";

type Row = { id: string; name: string; creditProfileCode: CreditProfileCode; creditLimit: Prisma.Decimal; creditStatus: CreditStatus };

export class PrismaCreditReviewCandidates implements CreditReviewCandidates {
  async list(input: { today: string; customerIds?: string[]; afterId?: string; limit: number }): Promise<CreditReviewCandidate[]> {
    const ids = input.customerIds ? [...new Set(input.customerIds)] : undefined;
    if (ids && ids.length === 0) return [];
    const rows = await getDb().$queryRaw<Row[]>`
      SELECT c.id, c.name, c."creditProfileCode", c."creditLimit", c."creditStatus"
      FROM "Customer" c
      WHERE c."creditStatus" = 'ACTIVE'
        ${input.afterId ? Prisma.sql`AND c.id > ${input.afterId}` : Prisma.empty}
        ${ids ? Prisma.sql`AND c.id IN (${Prisma.join(ids)})` : Prisma.empty}
        AND NOT EXISTS (
          SELECT 1 FROM "CreditLimitChange" h
          WHERE h."customerId" = c.id AND h.source = 'AUTO_REVIEW'
            AND (h."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo')::date = ${input.today}::date)
      ORDER BY c.id
      LIMIT ${input.limit}`;
    return rows.map((r) => ({
      customerId: r.id,
      customerName: r.name,
      profileCode: r.creditProfileCode,
      limitCents: toCents(Number(r.creditLimit)),
      status: r.creditStatus,
    }));
  }
}
