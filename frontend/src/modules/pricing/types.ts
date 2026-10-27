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

export type TargetMarginSource = 'VARIANT' | 'PRODUCT' | 'CATEGORY' | 'STORE';

export interface PriceMargin {
  /** R$ por unidade. */
  amount: number;
  /** Percentual (ex.: 32.15). */
  percent: number;
}

export interface PaymentSimulation {
  condition: 'CASH' | 'DEBIT' | 'CREDIT';
  installments: number;
  /** true = a taxa do cartão é repassada ao cliente (preço cobrado maior). */
  passOn: boolean;
  price: number;
  margin: PriceMargin;
}

/** Matches backend VariantPricingDTO. */
export interface VariantPricing {
  variantId: string;
  /** Até 4 casas. */
  averageCost: number;
  expensesPercent: number;
  expensesAmount: number;
  targetMarginPercent: number;
  targetMarginSource: TargetMarginSource;
  suggestedPrice: number | null;
  salePrice: number;
  realMargin: PriceMargin;
  supplierSuggestedPrice: number | null;
  supplierSuggestedPriceUpdatedAt: string | null;
  supplierMargin: PriceMargin | null;
  simulations: PaymentSimulation[];
}

export type ApplyPriceSource = 'SUGGESTED' | 'SUPPLIER';

export type PriceReviewReason = 'COST_CHANGED' | 'SETTINGS_CHANGED' | 'MARGIN_CHANGED' | 'MARGIN_BELOW_TARGET';

/** Matches backend PriceReviewDTO. */
export interface PriceReview {
  id: string;
  productVariantId: string;
  label: string;
  currentPrice: number;
  suggestedPrice: number;
  /** sugerido − atual (negativo = baixar). */
  difference: number;
  reason: PriceReviewReason;
  status: 'PENDING' | 'APPLIED' | 'DISMISSED';
  createdAt: string;
}

export interface ApplyReviewsResult {
  applied: string[];
  skipped: string[];
  /** Os mesmos ids de `skipped`, com o motivo. */
  skippedDetails: { id: string; reason: 'NOT_PENDING' | 'NO_SUGGESTION' | 'NOT_FOUND' }[];
}
