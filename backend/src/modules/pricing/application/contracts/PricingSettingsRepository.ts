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
  /**
   * Trava compartilhada das configurações (advisory de transação, mesma chave): quem lê as configurações
   * para gravar revisões (gatilho de custo, aplicar revisões) espera uma escrita em andamento e a impede
   * até o próprio commit — a revisão nunca mistura custo novo com configuração velha.
   */
  lockSettingsShared(): Promise<void>;
  saveSettings(input: SaveSettingsInput): Promise<void>;
  listExpenses(): Promise<PricingExpenseRecord[]>;
  findExpense(id: string): Promise<PricingExpenseRecord | null>;
  createExpense(input: { name: string; percentBps: Bps; active: boolean }): Promise<PricingExpenseRecord>;
  updateExpense(
    id: string,
    input: { name: string; percentBps: Bps; active: boolean; position?: number },
  ): Promise<void>;
  deleteExpense(id: string): Promise<void>;
  /** Maior margem-alvo gravada em categoria, produto ou variante (0 se nenhuma): entra na soma 100%. */
  maxLevelMarginBps(): Promise<Bps>;
  /** false se o registro do nível não existe. */
  setTargetMargin(level: TargetMarginLevel, id: string, bps: Bps | null): Promise<boolean>;
}
