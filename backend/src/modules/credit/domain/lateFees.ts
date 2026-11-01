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


/** Pagamento de uma parcela, do ponto de vista dos encargos. */
export interface LateFeePaymentInfo {
  amountCents: number;
  fineCents: number;
  interestCents: number;
  /** "YYYY-MM-DD" (data de negócio). */
  paymentDate: string;
  /** Estornado: não conta (nem o principal nem os encargos). */
  reversed: boolean;
}

export type LateFeeRates = Pick<Parameters<typeof computeLateFees>[0], "graceDays" | "fineBps" | "monthlyInterestBps">;

export interface ParcelLateFees extends LateFees {
  principalRemainingCents: number;
}

/**
 * Encargos de uma parcela se paga em `paymentDate`, a partir dos pagamentos já registrados:
 * restante = valor − Σ principal ativo; multa já cobrada = algum pagamento ativo com multa;
 * juros desde a data do último pagamento ativo que cobrou encargo (senão desde o vencimento).
 * `exempt` (documento `noLateFees`) → sem encargos.
 */
export function parcelLateFees(input: {
  amountCents: number;
  dueDate: string;
  payments: readonly LateFeePaymentInfo[];
  paymentDate: string;
  rates: LateFeeRates;
  exempt: boolean;
}): ParcelLateFees {
  const active = input.payments.filter((p) => !p.reversed);
  const paid = active.reduce((sum, p) => sum + p.amountCents, 0);
  const principalRemainingCents = Math.max(0, input.amountCents - paid);
  const charged = active.filter((p) => p.fineCents + p.interestCents > 0);
  const interestFrom = charged.reduce<string | null>(
    (latest, p) => (latest === null || p.paymentDate > latest ? p.paymentDate : latest),
    null,
  );
  const fees = computeLateFees({
    principalRemainingCents,
    dueDate: input.dueDate,
    paymentDate: input.paymentDate,
    ...input.rates,
    fineAlreadyCharged: active.some((p) => p.fineCents > 0),
    interestFrom,
  });
  if (input.exempt) return { daysLate: fees.daysLate, fineCents: 0, interestCents: 0, principalRemainingCents };
  return { ...fees, principalRemainingCents };
}
