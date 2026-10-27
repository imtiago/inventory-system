import { getDb } from "@shared/infrastructure/prisma/transactionContext";
import { readTogether } from "@shared/infrastructure/database/readTogether";
import type {
  PricingMarginSettings,
  PricingSettingsReader,
  PricingSettingsSnapshot,
} from "@pricing/application/contracts/PricingSettingsReader";
import { parseStoredCardFees, ZERO_CARD_FEES } from "./cardFeesJson";

export class PrismaPricingSettingsReader implements PricingSettingsReader {
  async get(): Promise<PricingSettingsSnapshot> {
    const { settings, cardFeesJson } = await this.read();
    return { ...settings, cardFees: settings.configured ? parseStoredCardFees(cardFeesJson) : ZERO_CARD_FEES };
  }

  async getMarginSettings(): Promise<PricingMarginSettings> {
    return (await this.read()).settings;
  }

  private async read(): Promise<{ settings: PricingMarginSettings; cardFeesJson: unknown }> {
    const db = getDb();
    const [row, sum] = await readTogether([
      db.pricingSettings.findUnique({ where: { id: "default" } }),
      db.pricingExpense.aggregate({ where: { active: true }, _sum: { percentBps: true } }),
    ]);
    const expensesBps = sum._sum.percentBps ?? 0;
    if (!row) {
      return {
        settings: {
          configured: false,
          defaultMarginBps: 0,
          roundingStrategy: "STORE_TABLE",
          alertThresholdBps: 200,
          expensesBps,
        },
        cardFeesJson: null,
      };
    }
    return {
      settings: {
        configured: true,
        defaultMarginBps: row.defaultMarginBps,
        roundingStrategy: row.roundingStrategy,
        alertThresholdBps: row.alertThresholdBps,
        expensesBps,
      },
      cardFeesJson: row.cardFees,
    };
  }
}
