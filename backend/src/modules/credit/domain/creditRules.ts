import { ceilDiv, type Bps } from "@shared/domain/percent";
import { CreditProfileCode, type CreditProfileParams } from "./CreditProfileCode";
import { assertNonNegativeInt } from "./creditInput";

/** Teto legal da multa por atraso (CDC, art. 52 §1º): 2%. */
export const MAX_FINE_BPS: Bps = 200;

export interface CreditBand {
  /** Valor financiado máximo da faixa (inclusive); null = sem teto. */
  upToCents: number | null;
  maxInstallments: number;
}

export interface CreditReviewRules {
  weights: {
    paidOnTime: number;
    relationshipMonth: number;
    relationshipMonthsCap: number;
    per100Paid: number;
    per100PaidCap: number;
    dayLate: number;
    paidLate30: number;
    renegotiation: number;
  };
  /** Pontuação mínima (inclusive) para subir a partir de cada perfil. */
  promoteAt: Record<"NEW" | "REGULAR" | "GOOD", number>;
  demoteIfDaysLateOver: number;
  suspendIfOverdueOver: number;
}

export interface CreditRules {
  bands: CreditBand[];
  minInstallmentCents: number;
  interestFreeInstallments: number;
  monthlyRateBps: Bps;
  defaultDueDay: number | null;
  overdueBlockDays: number;
  fineBps: Bps;
  monthlyInterestBps: Bps;
  graceDays: number;
  autoApproval: {
    profiles: CreditProfileCode[];
    maxDaysLate: number;
    minPaidInstallments: number;
    maxIncreaseBps: Bps;
  };
  review: CreditReviewRules;
}

/** Valores iniciais da spec (§2, §5, §6, §11); a loja confere e edita antes de ativar. */
export const DEFAULT_CREDIT_RULES: CreditRules = {
  bands: [
    { upToCents: 15000, maxInstallments: 2 },
    { upToCents: 30000, maxInstallments: 3 },
    { upToCents: 60000, maxInstallments: 5 },
    { upToCents: 100000, maxInstallments: 8 },
    { upToCents: null, maxInstallments: 10 },
  ],
  minInstallmentCents: 3000,
  interestFreeInstallments: 2,
  monthlyRateBps: 399,
  defaultDueDay: null,
  overdueBlockDays: 10,
  fineBps: 200,
  monthlyInterestBps: 100,
  graceDays: 3,
  autoApproval: {
    profiles: [CreditProfileCode.GOOD, CreditProfileCode.EXCELLENT],
    maxDaysLate: 5,
    minPaidInstallments: 6,
    maxIncreaseBps: 5000,
  },
  review: {
    weights: {
      paidOnTime: 10,
      relationshipMonth: 2,
      relationshipMonthsCap: 24,
      per100Paid: 1,
      per100PaidCap: 50,
      dayLate: -1,
      paidLate30: -15,
      renegotiation: -20,
    },
    promoteAt: { NEW: 40, REGULAR: 80, GOOD: 150 },
    demoteIfDaysLateOver: 30,
    suspendIfOverdueOver: 60,
  },
};

/**
 * Máximo de parcelas da faixa do valor financiado: a primeira faixa (em ordem
 * crescente de teto, null por último) cujo teto ≥ valor. Sem faixa → 1.
 */
export function bandMaxInstallments(financedCents: number, bands: CreditBand[]): number {
  assertNonNegativeInt(financedCents, "financedCents");
  const sorted = [...bands].sort((a, b) => (a.upToCents ?? Infinity) - (b.upToCents ?? Infinity));
  const band = sorted.find((b) => b.upToCents === null || financedCents <= b.upToCents);
  return band ? band.maxInstallments : 1;
}

/** Menor entre faixa, perfil e floor(financiado / parcela mínima); no mínimo 1. */
export function maxInstallmentsFor(financedCents: number, rules: CreditRules, profile: CreditProfileParams): number {
  const byMinInstallment = rules.minInstallmentCents > 0 ? Math.floor(financedCents / rules.minInstallmentCents) : Infinity;
  return Math.max(1, Math.min(bandMaxInstallments(financedCents, rules.bands), profile.maxInstallments, byMinInstallment));
}

/** Entrada mínima do perfil: total × bps, arredondado para cima. */
export function minDownPaymentCents(totalCents: number, profile: CreditProfileParams): number {
  assertNonNegativeInt(totalCents, "totalCents");
  return ceilDiv(totalCents * profile.minDownPaymentBps, 10_000);
}
