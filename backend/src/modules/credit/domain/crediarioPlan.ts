import type { Bps } from "@shared/domain/percent";
import { divideCentsRoundHalfUp } from "@shared/domain/money";
import type { CreditProfileParams } from "./CreditProfileCode";
import { maxInstallmentsFor, type CreditRules } from "./creditRules";
import { buildPricePlan } from "./tablePrice";
import { assertNonNegativeInt, invalidCreditInput } from "./creditInput";

export interface CrediarioOption {
  installments: number;
  downPaymentCents: number;
  financedCents: number;
  installmentCents: number;
  lastInstallmentCents: number;
  parcels: number[];
  /** entrada + parcelas */
  totalCents: number;
  /** Σ parcelas − financiado */
  surchargeCents: number;
  /** acréscimo ÷ financiado, em bps (meio para cima) */
  surchargeBps: Bps;
}

/**
 * Simulação do crediário: uma opção para cada quantidade 1..máximo
 * (`maxInstallmentsFor`). Até `interestFreeInstallments` sem juros (divisão
 * simples, a última recebe o resto); acima, Tabela Price a `monthlyRateBps`.
 * Não valida a entrada mínima do perfil (use `minDownPaymentCents`).
 * Entrada = total (nada a financiar) → nenhuma opção.
 */
export function crediarioOptions(input: {
  totalCents: number;
  downPaymentCents: number;
  rules: CreditRules;
  profile: CreditProfileParams;
}): CrediarioOption[] {
  const { totalCents, downPaymentCents, rules, profile } = input;
  assertNonNegativeInt(totalCents, "totalCents");
  assertNonNegativeInt(downPaymentCents, "downPaymentCents");
  if (downPaymentCents > totalCents) throw invalidCreditInput("Down payment exceeds the total.");

  const financedCents = totalCents - downPaymentCents;
  if (financedCents === 0) return [];

  const max = maxInstallmentsFor(financedCents, rules, profile);
  return Array.from({ length: max }, (_, i) => {
    const installments = i + 1;
    const rate = installments <= rules.interestFreeInstallments ? 0 : rules.monthlyRateBps;
    const plan = buildPricePlan(financedCents, rate, installments);
    const surchargeCents = plan.totalCents - financedCents;
    return {
      installments,
      downPaymentCents,
      financedCents,
      installmentCents: plan.installmentCents,
      lastInstallmentCents: plan.parcels[plan.parcels.length - 1],
      parcels: plan.parcels,
      totalCents: downPaymentCents + plan.totalCents,
      surchargeCents,
      surchargeBps: divideCentsRoundHalfUp(surchargeCents * 10_000, financedCents),
    };
  });
}
