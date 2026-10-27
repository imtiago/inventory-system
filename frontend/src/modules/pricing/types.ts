export type RoundingStrategy = 'STORE_TABLE' | 'END_90' | 'END_99' | 'INTEGER' | 'NONE';

export interface PricingExpense {
  id: string;
  name: string;
  /** Percentual (ex.: 7.5). */
  percent: number;
  active: boolean;
  position: number;
}

export interface PricingSettings {
  /** false até a primeira vez que a configuração é salva (sem preço sugerido enquanto isso). */
  configured: boolean;
  defaultMarginPercent: number;
  roundingStrategy: RoundingStrategy;
  alertThresholdPercent: number;
  cardFees: { debitPercent: number; creditPercent: Record<string, number> };
  expenses: PricingExpense[];
  expensesTotalPercent: number;
}

export type SaveSettingsInput = Omit<PricingSettings, 'configured' | 'expenses' | 'expensesTotalPercent'>;

export interface SaveExpenseInput {
  name: string;
  percent: number;
  active?: boolean;
}

export type TargetMarginLevel = 'category' | 'product' | 'variant';

/** Texto digitado (pt-BR) do formulário de configurações; `credit[i]` é o crédito em (i + 1)x. */
export interface SettingsFormValues {
  defaultMargin: string;
  roundingStrategy: RoundingStrategy;
  alertThreshold: string;
  debit: string;
  credit: string[];
}
