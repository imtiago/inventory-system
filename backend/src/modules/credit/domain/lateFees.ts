import { applyBps, type Bps } from "@shared/domain/percent";
import { MAX_FINE_BPS } from "./creditRules";
import { daysBetween, parseDateOnly } from "./dueDates";
import { assertNonNegativeInt } from "./creditInput";
import { roundHalfUp } from "./tablePrice";

export interface LateFees {
  daysLate: number;
  fineCents: number;
  interestCents: number;
}

/**
 * Encargos de atraso sobre o restante da parcela, na data de pagamento (data de
 * negócio "YYYY-MM-DD" em São Paulo; vencimento "hoje" não conta atraso).
 * - daysLate = dias corridos de dueDate até paymentDate (≥ 0); daysLate ≤ graceDays → sem encargos.
 * - multa: uma vez por parcela (fineAlreadyCharged → 0), fineBps limitado a 2% (CDC), meio para cima.
 * - juros: pró-rata, mês = 30 dias, desde max(dueDate, interestFrom) até paymentDate;
 *   round(principal × monthlyInterestBps × dias / 300000), meio para cima.
 */
export function computeLateFees(input: {
  principalRemainingCents: number;
  dueDate: string;
  paymentDate: string;
  graceDays: number;
  fineBps: Bps;
  monthlyInterestBps: Bps;
  fineAlreadyCharged: boolean;
  interestFrom: string | null;
}): LateFees {
  const { principalRemainingCents: principal, dueDate, paymentDate, graceDays, fineBps, monthlyInterestBps, fineAlreadyCharged, interestFrom } = input;
  assertNonNegativeInt(principal, "principalRemainingCents");
  assertNonNegativeInt(graceDays, "graceDays");
  assertNonNegativeInt(fineBps, "fineBps");
  assertNonNegativeInt(monthlyInterestBps, "monthlyInterestBps");
  parseDateOnly(dueDate, "dueDate");
  parseDateOnly(paymentDate, "paymentDate");
  if (interestFrom !== null) parseDateOnly(interestFrom, "interestFrom");

  const daysLate = Math.max(0, daysBetween(dueDate, paymentDate));
  if (daysLate <= graceDays || principal === 0) return { daysLate, fineCents: 0, interestCents: 0 };

  const fineCents = fineAlreadyCharged ? 0 : applyBps(principal, Math.min(fineBps, MAX_FINE_BPS));

  const since = interestFrom !== null && interestFrom > dueDate ? interestFrom : dueDate;
  const interestDays = Math.max(0, daysBetween(since, paymentDate));
  const interestCents = Number(roundHalfUp(BigInt(principal) * BigInt(monthlyInterestBps) * BigInt(interestDays), 300_000n));

  return { daysLate, fineCents, interestCents };
}

