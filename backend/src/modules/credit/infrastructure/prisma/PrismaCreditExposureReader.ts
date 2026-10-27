import { Prisma } from "@prisma/client";
import { getDb } from "@shared/infrastructure/prisma/transactionContext";
import type { CreditExposure } from "@credit/domain/customerCredit";
import type { CreditExposureReader } from "@credit/application/contracts/CreditExposureReader";
import { receivableParcelsCte } from "./receivableParcelsSql";

export class PrismaCreditExposureReader implements CreditExposureReader {
  async forCustomer(customerId: string, today: string): Promise<CreditExposure> {
    const parcels = receivableParcelsCte(
      Prisma.sql`fd."partyId" = ${customerId}`,
      Prisma.sql`fd.status IN ('OPEN', 'PARTIALLY_PAID')`,
    );
    const [row] = await getDb().$queryRaw<{ open_c: bigint; overdue: number }[]>`
      WITH parcel AS (${parcels})
      SELECT COALESCE(SUM(remaining_c), 0)::bigint AS open_c,
             COALESCE(MAX(${today}::date - due) FILTER (WHERE remaining_c > 0 AND due < ${today}::date), 0)::int AS overdue
      FROM parcel`;
    return { openBalanceCents: Number(row.open_c), currentMaxOverdueDays: row.overdue };
  }
}
