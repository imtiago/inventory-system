import { BusinessRuleError, ConflictError, ErrorCodes, NotFoundError } from "@shared/domain/errors";
import { todayInBusinessTz } from "@shared/domain/businessDate";
import { fromCents } from "@shared/domain/money";
import type { PaginatedResult } from "@shared/application/dtos/PaginatedResult";
import type { PaginationRequest } from "@shared/application/dtos/PaginationRequest";
import type { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { canAutoApprove } from "@credit/domain/autoApproval";
import { CreditChangeSource, CreditStatus } from "@credit/domain/customerCredit";
import type { CreditRequestStatus } from "@credit/domain/creditLimitRequest";
import type { CustomerCreditRepository } from "@credit/application/contracts/CustomerCreditRepository";
import type { CreditHistoryReader } from "@credit/application/contracts/CreditHistoryReader";
import type { CreditSettingsReader } from "@credit/application/contracts/CreditSettingsReader";
import type { CreditLimitRequestRepository } from "@credit/application/contracts/CreditLimitRequestRepository";
import type { CustomerCreditService } from "@credit/application/services/CustomerCreditService";
import type { CreditLimitRequestDTO } from "@credit/application/dto/CreditLimitRequestDTO";

const HISTORY_MONTHS = 12;

async function load(requests: CreditLimitRequestRepository, id: string): Promise<CreditLimitRequestDTO> {
  const dto = await requests.findDtoById(id);
  if (!dto) throw new NotFoundError("Pedido de aumento não encontrado.", ErrorCodes.CREDIT_REQUEST_NOT_FOUND);
  return dto;
}

export interface RequestCreditLimitInput {
  customerId: string;
  requestedLimitCents: number;
  reason: string;
  userId: string;
}

/**
 * Qualquer vendedor pede. Trava a ficha do cliente (serializa pedidos simultâneos) → valida (maior que o
 * limite atual, sem pedido em aberto) → aprovação automática (`canAutoApprove` sobre o histórico de 12 meses;
 * só ficha ACTIVE) aplica o limite na mesma transação; senão grava PENDING.
 */
export class RequestCreditLimitUseCase {
  constructor(
    private readonly customers: CustomerCreditRepository,
    private readonly requests: CreditLimitRequestRepository,
    private readonly history: CreditHistoryReader,
    private readonly settings: CreditSettingsReader,
    private readonly credit: CustomerCreditService,
    private readonly transactionManager: TransactionManager,
    private readonly today: () => string = () => todayInBusinessTz(),
  ) {}

  execute(input: RequestCreditLimitInput): Promise<CreditLimitRequestDTO> {
    return this.transactionManager.execute(async () => {
      const current = await this.customers.lock(input.customerId);
      if (!current) throw new NotFoundError("Cliente não encontrado.", ErrorCodes.CUSTOMER_NOT_FOUND);
      if (input.requestedLimitCents <= current.limitCents) {
        throw new BusinessRuleError("O limite pedido deve ser maior que o limite atual.", ErrorCodes.CREDIT_LIMIT_NOT_HIGHER);
      }
      if (await this.requests.hasPendingForCustomer(input.customerId)) {
        throw new ConflictError("Já existe um pedido de aumento em aberto para este cliente.", ErrorCodes.CREDIT_REQUEST_ALREADY_PENDING);
      }

      let auto = false;
      if (current.status === CreditStatus.ACTIVE) {
        const { rules } = await this.settings.get();
        const history = (await this.history.forCustomers([input.customerId], this.today(), HISTORY_MONTHS)).get(input.customerId);
        auto =
          history !== undefined &&
          canAutoApprove({
            profile: current.profileCode,
            history,
            currentLimitCents: current.limitCents,
            requestedLimitCents: input.requestedLimitCents,
            rules: rules.autoApproval,
          });
      }

      const id = await this.requests.create({
        customerId: input.customerId,
        currentLimitCents: current.limitCents,
        requestedLimitCents: input.requestedLimitCents,
        reason: input.reason,
        requestedById: input.userId,
        autoApproved: auto,
      });
      if (auto) {
        await this.credit.applyChange({
          customerId: input.customerId,
          limitCents: input.requestedLimitCents,
          reason: "Aumento aprovado automaticamente (pedido de aumento)",
          source: CreditChangeSource.REQUEST,
          userId: input.userId,
        });
      }
      return load(this.requests, id);
    });
  }
}

export interface DecideCreditLimitRequestInput {
  id: string;
  userId: string;
  approvedLimitCents?: number;
  reason?: string;
}

/**
 * Aprova (pode ajustar o valor): trava o pedido → valida PENDING → trava a ficha do cliente e confere que o
 * valor aprovado ainda é maior que o limite atual (o limite pode ter mudado depois do pedido; aprovar nunca
 * baixa o limite → 422 CREDIT_LIMIT_NOT_HIGHER) → `applyChange` (reentrante) → decisão.
 */
export class ApproveCreditLimitRequestUseCase {
  constructor(
    private readonly requests: CreditLimitRequestRepository,
    private readonly credit: CustomerCreditService,
    private readonly transactionManager: TransactionManager,
    private readonly customers: Pick<CustomerCreditRepository, "lock">,
  ) {}

  execute({ id, userId, approvedLimitCents, reason }: DecideCreditLimitRequestInput): Promise<CreditLimitRequestDTO> {
    return this.transactionManager.execute(async () => {
      const request = await this.requests.lockById(id);
      if (!request) throw new NotFoundError("Pedido de aumento não encontrado.", ErrorCodes.CREDIT_REQUEST_NOT_FOUND);
      const limitCents = request.approve(userId, approvedLimitCents, reason ?? null);
      const current = await this.customers.lock(request.customerId);
      if (!current) throw new NotFoundError("Cliente não encontrado.", ErrorCodes.CUSTOMER_NOT_FOUND);
      if (limitCents <= current.limitCents) {
        throw new BusinessRuleError(
          "O limite aprovado deve ser maior que o limite atual do cliente.",
          ErrorCodes.CREDIT_LIMIT_NOT_HIGHER,
          { currentLimit: fromCents(current.limitCents) },
        );
      }
      await this.credit.applyChange({
        customerId: request.customerId,
        limitCents,
        reason: reason ? `Pedido de aumento aprovado: ${reason}` : "Pedido de aumento aprovado",
        source: CreditChangeSource.REQUEST,
        userId,
      });
      await this.requests.saveDecision(request);
      return load(this.requests, id);
    });
  }
}

/** Recusa (motivo obrigatório): trava o pedido → valida PENDING → REJECTED. A ficha não muda. */
export class RejectCreditLimitRequestUseCase {
  constructor(
    private readonly requests: CreditLimitRequestRepository,
    private readonly transactionManager: TransactionManager,
  ) {}

  execute({ id, userId, reason }: DecideCreditLimitRequestInput): Promise<CreditLimitRequestDTO> {
    return this.transactionManager.execute(async () => {
      const request = await this.requests.lockById(id);
      if (!request) throw new NotFoundError("Pedido de aumento não encontrado.", ErrorCodes.CREDIT_REQUEST_NOT_FOUND);
      request.reject(userId, reason ?? "");
      await this.requests.saveDecision(request);
      return load(this.requests, id);
    });
  }
}

export class ListCreditLimitRequestsUseCase {
  constructor(private readonly requests: CreditLimitRequestRepository) {}

  execute(pagination: PaginationRequest, filter: { status?: CreditRequestStatus } = {}): Promise<PaginatedResult<CreditLimitRequestDTO>> {
    return this.requests.list(pagination, filter);
  }

  countPending(): Promise<number> {
    return this.requests.countPending();
  }
}
