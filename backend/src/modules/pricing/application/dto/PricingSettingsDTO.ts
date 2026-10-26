import { bpsToPercent } from "@shared/domain/percent";
import type { PricingExpenseRecord } from "@pricing/application/contracts/PricingSettingsRepository";
import type { PricingSettingsSnapshot } from "@pricing/application/contracts/PricingSettingsReader";
import type { RoundingStrategy } from "@pricing/domain/priceRounding";

export interface PricingExpenseDTO {
  id: string;
  name: string;
  percent: number;
  active: boolean;
  position: number;
}

export interface PricingSettingsDTO {
  configured: boolean;
  defaultMarginPercent: number;
  roundingStrategy: RoundingStrategy;
  alertThresholdPercent: number;
  cardFees: { debitPercent: number; creditPercent: Record<string, number> };
  expenses: PricingExpenseDTO[];
  expensesTotalPercent: number;
}

export function toExpenseDTO(e: PricingExpenseRecord): PricingExpenseDTO {
  return { id: e.id, name: e.name, percent: bpsToPercent(e.percentBps), active: e.active, position: e.position };
}

export function toSettingsDTO(s: PricingSettingsSnapshot, expenses: PricingExpenseRecord[]): PricingSettingsDTO {
  const creditPercent: Record<string, number> = {};
  for (let i = 1; i <= 12; i++) creditPercent[String(i)] = bpsToPercent(s.cardFees.creditBps[i] ?? 0);
  return {
    configured: s.configured,
    defaultMarginPercent: bpsToPercent(s.defaultMarginBps),
    roundingStrategy: s.roundingStrategy,
    alertThresholdPercent: bpsToPercent(s.alertThresholdBps),
    cardFees: { debitPercent: bpsToPercent(s.cardFees.debitBps), creditPercent },
    expenses: expenses.map(toExpenseDTO),
    expensesTotalPercent: bpsToPercent(s.expensesBps),
  };
}
