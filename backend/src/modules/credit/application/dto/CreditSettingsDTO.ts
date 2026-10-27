import { bpsToPercent } from "@shared/domain/percent";
import { fromCents } from "@shared/domain/money";
import type { CreditProfileCode } from "@credit/domain/CreditProfileCode";
import type { CreditReviewRules, CreditRules } from "@credit/domain/creditRules";
import type { CreditSettingsRecord, UserRef } from "@credit/application/contracts/CreditSettingsRepository";

/** Regras na API: dinheiro em reais, percentuais em %. */
export interface CreditRulesDTO {
  bands: { upTo: number | null; maxInstallments: number }[];
  minInstallment: number;
  interestFreeInstallments: number;
  monthlyRatePercent: number;
  defaultDueDay: number | null;
  overdueBlockDays: number;
  finePercent: number;
  monthlyInterestPercent: number;
  graceDays: number;
  autoApproval: {
    profiles: CreditProfileCode[];
    maxDaysLate: number;
    minPaidInstallments: number;
    maxIncreasePercent: number;
  };
  review: CreditReviewRules;
}

export interface CreditSettingsDTO {
  crediarioEnabled: boolean;
  enabledAt: Date | null;
  enabledBy: UserRef | null;
  updatedAt: Date;
  updatedBy: UserRef | null;
  rules: CreditRulesDTO;
}

export function toCreditRulesDTO(r: CreditRules): CreditRulesDTO {
  return {
    bands: r.bands.map((b) => ({ upTo: b.upToCents === null ? null : fromCents(b.upToCents), maxInstallments: b.maxInstallments })),
    minInstallment: fromCents(r.minInstallmentCents),
    interestFreeInstallments: r.interestFreeInstallments,
    monthlyRatePercent: bpsToPercent(r.monthlyRateBps),
    defaultDueDay: r.defaultDueDay,
    overdueBlockDays: r.overdueBlockDays,
    finePercent: bpsToPercent(r.fineBps),
    monthlyInterestPercent: bpsToPercent(r.monthlyInterestBps),
    graceDays: r.graceDays,
    autoApproval: {
      profiles: [...r.autoApproval.profiles],
      maxDaysLate: r.autoApproval.maxDaysLate,
      minPaidInstallments: r.autoApproval.minPaidInstallments,
      maxIncreasePercent: bpsToPercent(r.autoApproval.maxIncreaseBps),
    },
    review: structuredClone(r.review),
  };
}

export function toCreditSettingsDTO(s: CreditSettingsRecord): CreditSettingsDTO {
  return {
    crediarioEnabled: s.crediarioEnabled,
    enabledAt: s.enabledAt,
    enabledBy: s.enabledBy,
    updatedAt: s.updatedAt,
    updatedBy: s.updatedBy,
    rules: toCreditRulesDTO(s.rules),
  };
}
