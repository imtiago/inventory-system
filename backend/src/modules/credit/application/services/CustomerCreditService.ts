import { ErrorCodes, NotFoundError } from "@shared/domain/errors";
import type { TransactionManager } from "@shared/application/transaction/TransactionManager";
import type { CreditProfileCode } from "@credit/domain/CreditProfileCode";
import { assertNonNegativeInt } from "@credit/domain/creditInput";
import type { CreditChangeSource, CreditStatus, CustomerCredit } from "@credit/domain/customerCredit";
import type { CustomerCreditRepository } from "@credit/application/contracts/CustomerCreditRepository";
import type { CreditLimitChangeRepository } from "@credit/application/contracts/CreditLimitChangeRepository";

export interface CreditChangeInput {
  customerId: string;
  profileCode?: CreditProfileCode;
  limitCents?: number;
  status?: CreditStatus;
  reason: string;
  source: CreditChangeSource;
  userId: string | null;
}

/**
 * Única porta de escrita da ficha de crédito: trava o cliente (reentrante na transação), grava perfil,
 * limite e situação e registra uma `CreditLimitChange` só se algo mudou. Perfil mudado sem `limitCents`
 * mantém o limite. Roda na transação do chamador, se houver.
 */
export class CustomerCreditService {
  constructor(
    private readonly customers: CustomerCreditRepository,
    private readonly changes: CreditLimitChangeRepository,
    private readonly transactionManager: TransactionManager,
  ) {}

  applyChange(input: CreditChangeInput): Promise<CustomerCredit> {
    if (input.limitCents !== undefined) assertNonNegativeInt(input.limitCents, "limitCents");
    return this.transactionManager.execute(async () => {
      const current = await this.customers.lock(input.customerId);
      if (!current) throw new NotFoundError("Cliente não encontrado.", ErrorCodes.CUSTOMER_NOT_FOUND);
      const next: CustomerCredit = {
        customerId: current.customerId,
        profileCode: input.profileCode ?? current.profileCode,
        limitCents: input.limitCents ?? current.limitCents,
        status: input.status ?? current.status,
      };
      if (
        next.profileCode === current.profileCode &&
        next.limitCents === current.limitCents &&
        next.status === current.status
      ) {
        return current;
      }
      await this.customers.save(next);
      await this.changes.record({
        customerId: current.customerId,
        fromProfile: current.profileCode,
        toProfile: next.profileCode,
        fromLimitCents: current.limitCents,
        toLimitCents: next.limitCents,
        fromStatus: current.status,
        toStatus: next.status,
        reason: input.reason,
        source: input.source,
        changedById: input.userId,
      });
      return next;
    });
  }
}
