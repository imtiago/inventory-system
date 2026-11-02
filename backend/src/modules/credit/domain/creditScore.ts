import { CREDIT_PROFILE_LABELS, CreditProfileCode, nextProfile, previousProfile } from "./CreditProfileCode";
import type { CreditReviewRules } from "./creditRules";

/**
 * Histórico de crédito do cliente na janela da revisão (últimos 12 meses),
 * sem dívidas do caderninho/`noLateFees` (não pioram perfil nem pontuação).
 */
export interface CreditHistory {
  /** Parcelas pagas sem atraso no período. */
  paidOnTime: number;
  /** Parcelas pagas com mais de 30 dias de atraso no período. */
  paidLate30Plus: number;
  /** Soma dos dias de atraso das parcelas pagas no período. */
  totalDaysLate: number;
  relationshipMonths: number;
  totalPaidCents: number;
  renegotiations: number;
  /** Maior atraso (dias) no período, pago ou em aberto. */
  maxDaysLateInPeriod: number;
  /** Maior atraso (dias) de parcela vencida ainda em aberto hoje; 0 se nenhuma. */
  currentMaxOverdueDays: number;
  /** Parcelas pagas no período (em dia ou não); atrasos = paidInstallments − paidOnTime. */
  paidInstallments: number;
}

export type CreditReviewAction = "UP" | "DOWN" | "SUSPEND" | "NONE";

export function scoreCredit(history: CreditHistory, weights: CreditReviewRules["weights"]): number {
  return (
    history.paidOnTime * weights.paidOnTime +
    Math.min(history.relationshipMonths, weights.relationshipMonthsCap) * weights.relationshipMonth +
    Math.min(Math.floor(history.totalPaidCents / 10_000), weights.per100PaidCap) * weights.per100Paid +
    history.totalDaysLate * weights.dayLate +
    history.paidLate30Plus * weights.paidLate30 +
    history.renegotiations * weights.renegotiation
  );
}

/**
 * Decisão da revisão periódica. Prioridade SUSPEND > DOWN > UP.
 * - SUSPEND: parcela vencida em aberto há mais de `suspendIfOverdueOver` dias.
 * - DOWN: atraso (no período ou em aberto) acima de `demoteIfDaysLateOver` dias; no perfil mais baixo → NONE.
 * - UP: pontuação ≥ patamar do perfil e nenhum atraso em aberto; no mais alto → NONE.
 */
export function reviewDecision(input: {
  profile: CreditProfileCode;
  score: number;
  history: CreditHistory;
  rules: CreditReviewRules;
}): { action: CreditReviewAction; reason: string } {
  const { profile, score, history, rules } = input;

  if (history.currentMaxOverdueDays > rules.suspendIfOverdueOver) {
    return { action: "SUSPEND", reason: `suspenso: parcela vencida há ${history.currentMaxOverdueDays} dias` };
  }

  const worstLate = Math.max(history.maxDaysLateInPeriod, history.currentMaxOverdueDays);
  if (worstLate > rules.demoteIfDaysLateOver) {
    const lower = previousProfile(profile);
    if (lower === null) return { action: "NONE", reason: `já está no perfil mais baixo; atraso de ${worstLate} dias no período` };
    return { action: "DOWN", reason: `desceu para ${CREDIT_PROFILE_LABELS[lower]}: atraso de ${worstLate} dias no período` };
  }

  const higher = nextProfile(profile);
  if (higher !== null && profile !== CreditProfileCode.EXCELLENT && history.currentMaxOverdueDays === 0) {
    const threshold = rules.promoteAt[profile];
    if (score >= threshold) {
      const late = Math.max(0, history.paidInstallments - history.paidOnTime);
      return {
        action: "UP",
        reason: `subiu para ${CREDIT_PROFILE_LABELS[higher]}: ${history.paidOnTime} parcelas em dia, ${late} atrasos`,
      };
    }
  }

  return { action: "NONE", reason: "sem mudança" };
}
