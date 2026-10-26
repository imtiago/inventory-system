import { getDb } from "@shared/infrastructure/prisma/transactionContext";
import { readTogether } from "@shared/infrastructure/database/readTogether";
import type { PricingSettingsReader, PricingSettingsSnapshot } from "@pricing/application/contracts/PricingSettingsReader";
import { parseStoredCardFees, ZERO_CARD_FEES } from "./cardFeesJson";

export class PrismaPricingSettingsReader implements PricingSettingsReader {
  async get(): Promise<PricingSettingsSnapshot> {
    const db = getDb();
    const [row, sum] = await readTogether([
      db.pricingSettings.findUnique({ where: { id: "default" } }),
      db.pricingExpense.aggregate({ where: { active: true }, _sum: { percentBps: true } }),
    ]);
    const expensesBps = sum._sum.percentBps ?? 0;
    if (!row) {
      return {
        configured: false,
        defaultMarginBps: 0,
        roundingStrategy: "STORE_TABLE",
        alertThresholdBps: 200,
        cardFees: ZERO_CARD_FEES,
        expensesBps,
      };
    }
    return {
      configured: true,
      defaultMarginBps: row.defaultMarginBps,
      roundingStrategy: row.roundingStrategy,
      alertThresholdBps: row.alertThresholdBps,
      cardFees: parseStoredCardFees(row.cardFees),
      expensesBps,
    };
  }
}
