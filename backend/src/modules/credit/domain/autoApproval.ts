import type { CreditProfileCode } from "./CreditProfileCode";
import type { CreditRules } from "./creditRules";
import type { CreditHistory } from "./creditScore";
import { assertNonNegativeInt } from "./creditInput";

/**
 * Aprovação automática de pedido de limite: perfil permitido, nenhum atraso
 * (no período ou em aberto) acima de `maxDaysLate`, ao menos
 * `minPaidInstallments` parcelas pagas e pedido ≤ limite atual × (1 + maxIncreaseBps).
 */
export function canAutoApprove(input: {
  profile: CreditProfileCode;
  history: CreditHistory;
  currentLimitCents: number;
  requestedLimitCents: number;
  rules: CreditRules["autoApproval"];
}): boolean {
  const { profile, history, currentLimitCents, requestedLimitCents, rules } = input;
  assertNonNegativeInt(currentLimitCents, "currentLimitCents");
  assertNonNegativeInt(requestedLimitCents, "requestedLimitCents");
  assertNonNegativeInt(rules.maxIncreaseBps, "maxIncreaseBps");

  if (!rules.profiles.includes(profile)) return false;
  if (Math.max(history.maxDaysLateInPeriod, history.currentMaxOverdueDays) > rules.maxDaysLate) return false;
  if (history.paidInstallments < rules.minPaidInstallments) return false;
  // requested ≤ current × (10000 + bps) / 10000, sem arredondar.
  return BigInt(requestedLimitCents) * 10_000n <= BigInt(currentLimitCents) * BigInt(10_000 + rules.maxIncreaseBps);
}
