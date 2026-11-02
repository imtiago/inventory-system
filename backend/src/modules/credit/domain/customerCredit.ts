import type { CreditProfileCode } from "./CreditProfileCode";
import { assertNonNegativeInt } from "./creditInput";

/** Situação da ficha de crédito. BLOCKED/SUSPENDED impedem compra nova no crediário. */
export enum CreditStatus {
  ACTIVE = "ACTIVE",
  BLOCKED = "BLOCKED",
  SUSPENDED = "SUSPENDED",
}

export const CREDIT_STATUS_LABELS: Record<CreditStatus, string> = {
  ACTIVE: "Ativo",
  BLOCKED: "Bloqueado",
  SUSPENDED: "Suspenso",
};

/** Origem de uma mudança na ficha (histórico). */
export enum CreditChangeSource {
  MANUAL = "MANUAL",
  AUTO_REVIEW = "AUTO_REVIEW",
  REQUEST = "REQUEST",
  LEGACY_IMPORT = "LEGACY_IMPORT",
}

/** Ficha de crédito do cliente (perfil, limite em centavos, situação). */
export interface CustomerCredit {
  customerId: string;
  profileCode: CreditProfileCode;
  limitCents: number;
  status: CreditStatus;
}

/** Exposição atual: saldo devedor em aberto e maior atraso de parcela com saldo (dias). */
export interface CreditExposure {
  openBalanceCents: number;
  /** Parte do saldo que é dívida do caderninho (LEGACY sem encargos); já incluída em `openBalanceCents`. */
  legacyOpenBalanceCents?: number;
  currentMaxOverdueDays: number;
}

/** Disponível = max(limite − saldo em aberto, 0). */
export function availableCents(limitCents: number, exposure: CreditExposure): number {
  assertNonNegativeInt(limitCents, "limitCents");
  assertNonNegativeInt(exposure.openBalanceCents, "openBalanceCents");
  return Math.max(limitCents - exposure.openBalanceCents, 0);
}
