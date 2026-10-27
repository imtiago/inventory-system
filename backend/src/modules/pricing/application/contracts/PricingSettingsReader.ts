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

/** Configuração sem as taxas de cartão: margens, arredondamento e despesas (revisão de preço, dashboard, relatórios). */
export type PricingMarginSettings = Omit<PricingSettingsSnapshot, "cardFees">;

export interface PricingSettingsReader {
  get(): Promise<PricingSettingsSnapshot>;
  /** Não lê as taxas de cartão: JSON de taxas inválido não derruba quem não usa taxas (ex.: entrada de estoque). */
  getMarginSettings(): Promise<PricingMarginSettings>;
}
