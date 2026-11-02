import { ErrorCodes, NotFoundError } from "@shared/domain/errors";
import { fromCents } from "@shared/domain/money";
import { todayInBusinessTz } from "@shared/domain/businessDate";
import type { TransactionManager } from "@shared/application/transaction/TransactionManager";
import type { CreditProfileCode } from "@credit/domain/CreditProfileCode";
import { availableCents, CreditChangeSource, type CreditStatus } from "@credit/domain/customerCredit";
import type { CustomerCreditRepository } from "@credit/application/contracts/CustomerCreditRepository";
import type { CreditProfileReader } from "@credit/application/contracts/CreditProfileReader";
import type { CreditExposureReader } from "@credit/application/contracts/CreditExposureReader";
import type { CreditLimitChangeRepository } from "@credit/application/contracts/CreditLimitChangeRepository";
import type { CustomerCreditService } from "@credit/application/services/CustomerCreditService";
import { toCreditLimitChangeDTO, type CustomerCreditDTO } from "@credit/application/dto/CustomerCreditDTO";

const HISTORY_LIMIT = 100;

export class GetCustomerCreditUseCase {
  constructor(
    private readonly customers: CustomerCreditRepository,
    private readonly profiles: CreditProfileReader,
    private readonly exposure: CreditExposureReader,
    private readonly changes: CreditLimitChangeRepository,
    private readonly today: () => string = () => todayInBusinessTz(),
  ) {}

  async execute(customerId: string): Promise<CustomerCreditDTO> {
    const credit = await this.customers.find(customerId);
    if (!credit) throw new NotFoundError("Cliente não encontrado.", ErrorCodes.CUSTOMER_NOT_FOUND);
    const [profile, exposure, history] = [
      await this.profiles.byCode(credit.profileCode),
      await this.exposure.forCustomer(customerId, this.today()),
      await this.changes.listForCustomer(customerId, HISTORY_LIMIT),
    ];
    return {
      profileCode: credit.profileCode,
      profileName: profile.name,
      limit: fromCents(credit.limitCents),
      openBalance: fromCents(exposure.openBalanceCents),
      legacyOpenBalance: fromCents(exposure.legacyOpenBalanceCents ?? 0),
      available: fromCents(availableCents(credit.limitCents, exposure)),
      status: credit.status,
      currentMaxOverdueDays: exposure.currentMaxOverdueDays,
      history: history.map(toCreditLimitChangeDTO),
    };
  }
}

export interface UpdateCustomerCreditInput {
  customerId: string;
  profileCode?: CreditProfileCode;
  limitCents?: number;
  status?: CreditStatus;
  reason: string;
  userId: string | null;
}

/** Ajuste manual da ficha (`credit.manage`): trava o cliente, grava e registra no histórico. */
export class UpdateCustomerCreditUseCase {
  constructor(
    private readonly service: CustomerCreditService,
    private readonly get: GetCustomerCreditUseCase,
    private readonly transactionManager: TransactionManager,
  ) {}

  async execute(input: UpdateCustomerCreditInput): Promise<CustomerCreditDTO> {
    await this.transactionManager.execute(() =>
      this.service.applyChange({
        customerId: input.customerId,
        profileCode: input.profileCode,
        limitCents: input.limitCents,
        status: input.status,
        reason: input.reason,
        source: CreditChangeSource.MANUAL,
        userId: input.userId,
      }),
    );
    return this.get.execute(input.customerId);
  }
}
