export type CreditProfileCode = 'NEW' | 'REGULAR' | 'GOOD' | 'EXCELLENT';
export type CreditStatus = 'ACTIVE' | 'BLOCKED' | 'SUSPENDED';
export type CreditChangeSource = 'MANUAL' | 'AUTO_REVIEW' | 'REQUEST' | 'LEGACY_IMPORT';

export const CREDIT_STATUS_LABELS: Record<CreditStatus, string> = { ACTIVE: 'Ativo', BLOCKED: 'Bloqueado', SUSPENDED: 'Suspenso' };
export const CREDIT_SOURCE_LABELS: Record<CreditChangeSource, string> = {
  MANUAL: 'Ajuste manual',
  AUTO_REVIEW: 'Revisão automática',
  REQUEST: 'Pedido de limite',
  LEGACY_IMPORT: 'Importação do caderno',
};
export const CREDIT_PROFILE_NAMES: Record<CreditProfileCode, string> = { NEW: 'Novo', REGULAR: 'Regular', GOOD: 'Bom', EXCELLENT: 'Excelente' };

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
  promoteAt: { NEW: number; REGULAR: number; GOOD: number };
  demoteIfDaysLateOver: number;
  suspendIfOverdueOver: number;
}

/** Regras na API: dinheiro em reais, percentuais em %. */
export interface CreditRules {
  bands: { upTo: number | null; maxInstallments: number }[];
  minInstallment: number;
  interestFreeInstallments: number;
  monthlyRatePercent: number;
  defaultDueDay: number | null;
  overdueBlockDays: number;
  finePercent: number;
  monthlyInterestPercent: number;
  graceDays: number;
  autoApproval: { profiles: CreditProfileCode[]; maxDaysLate: number; minPaidInstallments: number; maxIncreasePercent: number };
  review: CreditReviewRules;
}

export interface UserRef {
  id: string;
  name: string;
}

export interface CreditSettings {
  crediarioEnabled: boolean;
  enabledAt: string | null;
  enabledBy: UserRef | null;
  updatedAt: string;
  updatedBy: UserRef | null;
  rules: CreditRules;
}

export interface UpdateCreditSettingsInput {
  crediarioEnabled?: boolean;
  rules?: CreditRules;
}

export interface CreditProfile {
  code: CreditProfileCode;
  name: string;
  initialLimit: number;
  minDownPaymentPercent: number;
  maxInstallments: number;
  position: number;
}

export interface UpdateCreditProfileInput {
  initialLimit: number;
  minDownPaymentPercent: number;
  maxInstallments: number;
}

export interface CreditHistoryEntry {
  id: string;
  fromProfile: CreditProfileCode;
  toProfile: CreditProfileCode;
  fromLimit: number;
  toLimit: number;
  fromStatus: CreditStatus;
  toStatus: CreditStatus;
  reason: string;
  source: CreditChangeSource;
  changedBy: UserRef | null;
  createdAt: string;
}

export interface CustomerCredit {
  profileCode: CreditProfileCode;
  profileName: string;
  limit: number;
  openBalance: number;
  available: number;
  status: CreditStatus;
  currentMaxOverdueDays: number;
  history: CreditHistoryEntry[];
}

export interface UpdateCustomerCreditInput {
  profileCode?: CreditProfileCode;
  limit?: number;
  status?: CreditStatus;
  reason: string;
}
