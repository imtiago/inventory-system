import type { Bps } from "@shared/domain/percent";

/** Perfis de crédito do cliente, do mais baixo ao mais alto. */
export enum CreditProfileCode {
  NEW = "NEW",
  REGULAR = "REGULAR",
  GOOD = "GOOD",
  EXCELLENT = "EXCELLENT",
}

export const CREDIT_PROFILE_ORDER: readonly CreditProfileCode[] = [
  CreditProfileCode.NEW,
  CreditProfileCode.REGULAR,
  CreditProfileCode.GOOD,
  CreditProfileCode.EXCELLENT,
];

export const CREDIT_PROFILE_LABELS: Record<CreditProfileCode, string> = {
  NEW: "Novo",
  REGULAR: "Regular",
  GOOD: "Bom",
  EXCELLENT: "Excelente",
};

/** Perfil acima (null no mais alto). */
export function nextProfile(code: CreditProfileCode): CreditProfileCode | null {
  const i = CREDIT_PROFILE_ORDER.indexOf(code);
  return i >= 0 && i < CREDIT_PROFILE_ORDER.length - 1 ? CREDIT_PROFILE_ORDER[i + 1] : null;
}

/** Perfil abaixo (null no mais baixo). */
export function previousProfile(code: CreditProfileCode): CreditProfileCode | null {
  const i = CREDIT_PROFILE_ORDER.indexOf(code);
  return i > 0 ? CREDIT_PROFILE_ORDER[i - 1] : null;
}

export interface CreditProfileParams {
  code: CreditProfileCode;
  name: string;
  initialLimitCents: number;
  minDownPaymentBps: Bps;
  maxInstallments: number;
}

/** Valores iniciais da spec (§3); a loja edita depois. */
export const DEFAULT_CREDIT_PROFILES: readonly CreditProfileParams[] = [
  { code: CreditProfileCode.NEW, name: "Novo", initialLimitCents: 30000, minDownPaymentBps: 3000, maxInstallments: 3 },
  { code: CreditProfileCode.REGULAR, name: "Regular", initialLimitCents: 80000, minDownPaymentBps: 1500, maxInstallments: 5 },
  { code: CreditProfileCode.GOOD, name: "Bom", initialLimitCents: 200000, minDownPaymentBps: 0, maxInstallments: 8 },
  { code: CreditProfileCode.EXCELLENT, name: "Excelente", initialLimitCents: 500000, minDownPaymentBps: 0, maxInstallments: 10 },
];
