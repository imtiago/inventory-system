import { Prisma } from "@prisma/client";
import { InternalErrorCodes, InternalInvariantError } from "@shared/domain/errors";
import { fromCents, toCents } from "@shared/domain/money";
import { getDb, hasActiveTransaction } from "@shared/infrastructure/prisma/transactionContext";
import type { CreditProfileCode } from "@credit/domain/CreditProfileCode";
import type { CreditStatus, CustomerCredit } from "@credit/domain/customerCredit";
import type { CustomerCreditRepository } from "@credit/application/contracts/CustomerCreditRepository";

type Row = { id: string; creditProfileCode: CreditProfileCode; creditLimit: Prisma.Decimal; creditStatus: CreditStatus };

const toCredit = (r: Row): CustomerCredit => ({
  customerId: r.id,
  profileCode: r.creditProfileCode,
  limitCents: toCents(Number(r.creditLimit)),
  status: r.creditStatus,
});

function requireTransaction() {
  if (!hasActiveTransaction()) {
    throw new InternalInvariantError("Trava da ficha de crédito exige transação ativa.", InternalErrorCodes.LOCK_OUTSIDE_TRANSACTION);
  }
}

/**
 * `FOR NO KEY UPDATE`: conflita com outro lock/UPDATE da ficha (serializa ler-e-gravar), mas não com o
 * `FOR KEY SHARE` das FKs — criar venda/documento para o cliente não espera esta trava.
 */
export class PrismaCustomerCreditRepository implements CustomerCreditRepository {
  async find(customerId: string): Promise<CustomerCredit | null> {
    const row = await getDb().customer.findUnique({
      where: { id: customerId },
      select: { id: true, creditProfileCode: true, creditLimit: true, creditStatus: true },
    });
    return row ? toCredit(row as Row) : null;
  }

  async lock(customerId: string): Promise<CustomerCredit | null> {
    requireTransaction();
    const rows = await getDb().$queryRaw<Row[]>`
      SELECT id, "creditProfileCode", "creditLimit", "creditStatus"
      FROM "Customer" WHERE id = ${customerId} FOR NO KEY UPDATE`;
    return rows[0] ? toCredit(rows[0]) : null;
  }

  async lockMany(customerIds: string[]): Promise<CustomerCredit[]> {
    requireTransaction();
    const ids = [...new Set(customerIds)];
    if (ids.length === 0) return [];
    const rows = await getDb().$queryRaw<Row[]>`
      SELECT id, "creditProfileCode", "creditLimit", "creditStatus"
      FROM "Customer" WHERE id IN (${Prisma.join(ids)}) ORDER BY id FOR NO KEY UPDATE`;
    return rows.map(toCredit);
  }

  async save(credit: CustomerCredit): Promise<void> {
    await getDb().customer.update({
      where: { id: credit.customerId },
      data: {
        creditProfileCode: credit.profileCode,
        creditLimit: fromCents(credit.limitCents),
        creditStatus: credit.status,
      },
    });
  }
}
