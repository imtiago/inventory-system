import { BusinessRuleError, ErrorCodes, NotFoundError, ValidationError } from "@shared/domain/errors";
import { fromCents, toCents } from "@shared/domain/money";
import type { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { crediarioOptions, type CrediarioOption } from "@credit/domain/crediarioPlan";
import { maxInstallmentsFor, minDownPaymentCents, type CreditRules } from "@credit/domain/creditRules";
import { crediarioDueDates } from "@credit/domain/dueDates";
import { availableCents, CreditStatus, type CustomerCredit } from "@credit/domain/customerCredit";
import type { CreditSettingsReader } from "@credit/application/contracts/CreditSettingsReader";
import type { CreditProfileReader } from "@credit/application/contracts/CreditProfileReader";
import type { CreditExposureReader } from "@credit/application/contracts/CreditExposureReader";
import type { CustomerCreditRepository } from "@credit/application/contracts/CustomerCreditRepository";
import type { CreditOverrideAuthorizer, CreditOverrideInput } from "./CreditOverrideAuthorizer";

export interface CrediarioPaymentInput {
  installments: number;
  /** Reais (≤ 2 casas). */
  downPayment: number;
  downPaymentMethod?: "CASH" | "PIX" | "DEBIT_CARD" | "CREDIT_CARD";
  /** 1..28 */
  dueDay?: number;
}

export type CreditOverrideKind = "LIMIT" | "OVERDUE";

export interface CrediarioDecision {
  option: CrediarioOption;
  /** "YYYY-MM-DD", uma por parcela. */
  dueDates: string[];
  overrideById: string | null;
  overrideKinds: CreditOverrideKind[];
  /** Taxa aplicada no plano (0 até as parcelas sem acréscimo). */
  monthlyRateBps: number;
  /** Dia escolhido (ou o padrão da loja); null = mesmo dia de hoje + 30. */
  dueDay: number | null;
  /** Multa/juros/carência das configurações lidas nesta venda (gravados no `SaleFinancing`). */
  lateFeeTerms: { fineBps: number; monthlyInterestBps: number; graceDays: number };
}

export type CrediarioBlockedReason = "DISABLED" | "SUSPENDED" | "OVERDUE" | "LIMIT";

export interface CrediarioQuote {
  allowed: boolean;
  blockedReason: CrediarioBlockedReason | null;
  availableCents: number;
  minDownPaymentCents: number;
  maxInstallments: number;
  options: CrediarioOption[];
}

const disabled = () =>
  new BusinessRuleError("O crediário ainda não foi ativado nas configurações.", ErrorCodes.CREDIARIO_DISABLED);

const isBlockedStatus = (status: CreditStatus) => status === CreditStatus.BLOCKED || status === CreditStatus.SUSPENDED;

/**
 * Regras do crediário na venda (spec §2–§4). `plan` roda na transação da venda e trava a ficha do cliente
 * (`FOR NO KEY UPDATE`) ANTES de ler o saldo em aberto — duas vendas simultâneas do mesmo cliente se
 * enfileiram e a segunda enxerga a primeira. Chame antes de travar estoque (ordem: cliente → inventários).
 */
export class CrediarioCheckoutService {
  constructor(
    private readonly settings: CreditSettingsReader,
    private readonly customers: CustomerCreditRepository,
    private readonly profiles: CreditProfileReader,
    private readonly exposure: CreditExposureReader,
    private readonly overrideAuthorizer: Pick<CreditOverrideAuthorizer, "authorize">,
    private readonly transactionManager: TransactionManager,
  ) {}

  /**
   * Ordem: CREDIARIO_DISABLED → BLOCKED/SUSPENDED (CREDIT_SUSPENDED, sem exceção) → entrada mínima →
   * parcelas permitidas → atraso > `overdueBlockDays` (exceção) → parcelas > disponível (exceção).
   * A autorização só é conferida quando alguma exceção é necessária.
   */
  plan(input: {
    customerId: string;
    itemsTotalCents: number;
    payment: CrediarioPaymentInput;
    override?: CreditOverrideInput;
    today: string;
    ip: string;
  }): Promise<CrediarioDecision> {
    return this.transactionManager.execute(async () => {
      const { crediarioEnabled, rules } = await this.settings.get();
      if (!crediarioEnabled) throw disabled();

      const credit = await this.customers.lock(input.customerId);
      if (!credit) throw new NotFoundError("Cliente não encontrado.", ErrorCodes.CUSTOMER_NOT_FOUND);
      if (isBlockedStatus(credit.status)) {
        throw new BusinessRuleError(
          "O crédito deste cliente está bloqueado ou suspenso para novas compras no crediário.",
          ErrorCodes.CREDIT_SUSPENDED,
        );
      }
      const profile = await this.profiles.byCode(credit.profileCode);

      const downPaymentCents = toCents(input.payment.downPayment);
      if (downPaymentCents >= input.itemsTotalCents) {
        throw new ValidationError("Dados inválidos.", [
          { field: "payment.crediario.downPayment", message: "A entrada deve ser menor que o total da venda." },
        ]);
      }
      const minDown = minDownPaymentCents(input.itemsTotalCents, profile);
      if (downPaymentCents < minDown) {
        throw new BusinessRuleError(
          `A entrada mínima para este cliente é R$ ${formatReais(minDown)}.`,
          ErrorCodes.DOWN_PAYMENT_TOO_LOW,
          { minDownPayment: fromCents(minDown) },
        );
      }

      const financedCents = input.itemsTotalCents - downPaymentCents;
      const maxInstallments = maxInstallmentsFor(financedCents, rules, profile);
      if (input.payment.installments > maxInstallments) {
        throw new BusinessRuleError(
          `Este valor permite no máximo ${maxInstallments} parcela(s) para este cliente.`,
          ErrorCodes.INSTALLMENTS_NOT_ALLOWED,
          { maxInstallments },
        );
      }
      const options = crediarioOptions({ totalCents: input.itemsTotalCents, downPaymentCents, rules, profile });
      const option = options[input.payment.installments - 1];

      const exposure = await this.exposure.forCustomer(input.customerId, input.today);
      const available = availableCents(credit.limitCents, exposure);
      const required = option.totalCents - option.downPaymentCents;
      const kinds: CreditOverrideKind[] = [];
      if (exposure.currentMaxOverdueDays > rules.overdueBlockDays) {
        if (!input.override) {
          throw new BusinessRuleError(
            `O cliente tem parcela vencida há mais de ${rules.overdueBlockDays} dias. A venda precisa de autorização.`,
            ErrorCodes.CREDIT_OVERDUE_BLOCK,
            { overdueDays: exposure.currentMaxOverdueDays },
          );
        }
        kinds.push("OVERDUE");
      }
      if (required > available) {
        if (!input.override) {
          throw new BusinessRuleError(
            `As parcelas (R$ ${formatReais(required)}) passam do crédito disponível (R$ ${formatReais(available)}). A venda precisa de autorização.`,
            ErrorCodes.CREDIT_LIMIT_EXCEEDED,
            { available: fromCents(available), required: fromCents(required) },
          );
        }
        kinds.push("LIMIT");
      }

      const overrideById =
        kinds.length > 0 && input.override
          ? (await this.overrideAuthorizer.authorize(input.override, input.ip)).approverId
          : null;

      const dueDay = input.payment.dueDay ?? rules.defaultDueDay;
      return {
        option,
        dueDates: crediarioDueDates(input.today, option.installments, dueDay),
        overrideById,
        overrideKinds: kinds,
        monthlyRateBps: option.installments <= rules.interestFreeInstallments ? 0 : rules.monthlyRateBps,
        dueDay,
        lateFeeTerms: { fineBps: rules.fineBps, monthlyInterestBps: rules.monthlyInterestBps, graceDays: rules.graceDays },
      };
    });
  }

  /**
   * Simulação (sem trava, não grava): opções 1..máximo com a entrada pedida (mínimo do perfil se
   * ausente ou menor). Bloqueio: DISABLED → SUSPENDED → OVERDUE → LIMIT (financiado > disponível).
   * Cliente inexistente → 404.
   */
  async quote(input: { customerId: string; itemsTotalCents: number; downPaymentCents?: number; today: string }): Promise<CrediarioQuote> {
    const [{ crediarioEnabled, rules }, credit] = await Promise.all([
      this.settings.get(),
      this.customers.find(input.customerId),
    ]);
    if (!credit) throw new NotFoundError("Cliente não encontrado.", ErrorCodes.CUSTOMER_NOT_FOUND);
    const [profile, exposure] = await Promise.all([
      this.profiles.byCode(credit.profileCode),
      this.exposure.forCustomer(input.customerId, input.today),
    ]);
    const available = availableCents(credit.limitCents, exposure);
    const minDown = minDownPaymentCents(input.itemsTotalCents, profile);
    const downPaymentCents = Math.max(input.downPaymentCents ?? minDown, minDown);
    // Entrada = total: nada a financiar (sem opções).
    const financedCents = Math.max(input.itemsTotalCents - downPaymentCents, 0);
    const reason = blockedReason(crediarioEnabled, credit, rules, exposure.currentMaxOverdueDays, financedCents > available);
    return {
      allowed: reason === null && financedCents > 0,
      blockedReason: reason,
      availableCents: available,
      minDownPaymentCents: minDown,
      maxInstallments: financedCents > 0 ? maxInstallmentsFor(financedCents, rules, profile) : 0,
      options:
        financedCents > 0 ? crediarioOptions({ totalCents: input.itemsTotalCents, downPaymentCents, rules, profile }) : [],
    };
  }
}

function blockedReason(
  enabled: boolean,
  credit: CustomerCredit,
  rules: CreditRules,
  overdueDays: number,
  overLimit: boolean,
): CrediarioBlockedReason | null {
  if (!enabled) return "DISABLED";
  if (isBlockedStatus(credit.status)) return "SUSPENDED";
  if (overdueDays > rules.overdueBlockDays) return "OVERDUE";
  if (overLimit) return "LIMIT";
  return null;
}

function formatReais(cents: number): string {
  return fromCents(cents).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
