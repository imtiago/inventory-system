import { InternalErrorCodes, InternalInvariantError } from "@shared/domain/errors";
import { fromCents, toCents } from "@shared/domain/money";
import { getDb } from "@shared/infrastructure/prisma/transactionContext";
import type { CreditProfileCode, CreditProfileParams } from "@credit/domain/CreditProfileCode";
import type { CreditProfileRepository } from "@credit/application/contracts/CreditProfileReader";

type Row = { code: string; name: string; initialLimit: unknown; minDownPaymentBps: number; maxInstallments: number };

const toParams = (r: Row): CreditProfileParams => ({
  code: r.code as CreditProfileCode,
  name: r.name,
  initialLimitCents: toCents(Number(r.initialLimit)),
  minDownPaymentBps: r.minDownPaymentBps,
  maxInstallments: r.maxInstallments,
});

export class PrismaCreditProfileRepository implements CreditProfileRepository {
  async list(): Promise<CreditProfileParams[]> {
    const rows = await getDb().creditProfile.findMany({ orderBy: [{ position: "asc" }, { code: "asc" }] });
    return rows.map(toParams);
  }

  async byCode(code: CreditProfileCode): Promise<CreditProfileParams> {
    const row = await getDb().creditProfile.findUnique({ where: { code } });
    if (!row) throw new InternalInvariantError(`Perfil de crédito ${code} ausente.`, InternalErrorCodes.CREDIT_PROFILE_MISSING);
    return toParams(row);
  }

  async update(
    code: CreditProfileCode,
    input: { initialLimitCents: number; minDownPaymentBps: number; maxInstallments: number },
  ): Promise<void> {
    await getDb().creditProfile.update({
      where: { code },
      data: {
        initialLimit: fromCents(input.initialLimitCents),
        minDownPaymentBps: input.minDownPaymentBps,
        maxInstallments: input.maxInstallments,
      },
    });
  }
}
