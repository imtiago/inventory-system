import type { Bps } from "@shared/domain/percent";
import type { CardFees } from "@pricing/domain/cardFees";
import type { RoundingStrategy } from "@pricing/domain/priceRounding";

export interface PricingSettingsSnapshot {
  /** false = ninguém salvou as configurações ainda (valores padrão). */
  configured: boolean;
  defaultMarginBps: Bps;
  roundingStrategy: RoundingStrategy;
  alertThresholdBps: Bps;
  cardFees: CardFees;
  /** Σ das despesas ativas. */
  expensesBps: Bps;
}

export interface PricingSettingsReader {
  get(): Promise<PricingSettingsSnapshot>;
}
