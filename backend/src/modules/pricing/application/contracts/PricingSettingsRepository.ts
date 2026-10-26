import type { Bps } from "@shared/domain/percent";
import type { CardFees } from "@pricing/domain/cardFees";
import type { RoundingStrategy } from "@pricing/domain/priceRounding";

export interface PricingExpenseRecord {
  id: string;
  name: string;
  percentBps: Bps;
  active: boolean;
  position: number;
}

export interface SaveSettingsInput {
  defaultMarginBps: Bps;
  roundingStrategy: RoundingStrategy;
  alertThresholdBps: Bps;
  cardFees: CardFees;
  updatedById: string | null;
}

export type TargetMarginLevel = "category" | "product" | "variant";

export interface PricingSettingsRepository {
  /** Mutex das escritas que validam a soma despesas + margem (vale até o fim da transação). */
  lockSettings(): Promise<void>;
  saveSettings(input: SaveSettingsInput): Promise<void>;
  listExpenses(): Promise<PricingExpenseRecord[]>;
  findExpense(id: string): Promise<PricingExpenseRecord | null>;
  createExpense(input: { name: string; percentBps: Bps; active: boolean }): Promise<PricingExpenseRecord>;
  updateExpense(
    id: string,
    input: { name: string; percentBps: Bps; active: boolean; position?: number },
  ): Promise<void>;
  deleteExpense(id: string): Promise<void>;
  /** false se o registro do nível não existe. */
  setTargetMargin(level: TargetMarginLevel, id: string, bps: Bps | null): Promise<boolean>;
}
