import { getDb } from "@shared/infrastructure/prisma/transactionContext";
import type {
  PricingExpenseRecord,
  PricingSettingsRepository,
  SaveSettingsInput,
  TargetMarginLevel,
} from "@pricing/application/contracts/PricingSettingsRepository";
import { serializeCardFees } from "./cardFeesJson";

const expenseSelect = { id: true, name: true, percentBps: true, active: true, position: true } as const;

export class PrismaPricingSettingsRepository implements PricingSettingsRepository {
  // Mutex por advisory lock de transação: a linha de configuração só nasce no primeiro PUT
  // (criá-la aqui marcaria `configured` sem o usuário ter salvo nada).
  async lockSettings(): Promise<void> {
    await getDb().$executeRaw`SELECT pg_advisory_xact_lock(hashtext('pricing_settings'))`;
  }

  async lockSettingsShared(): Promise<void> {
    await getDb().$executeRaw`SELECT pg_advisory_xact_lock_shared(hashtext('pricing_settings'))`;
  }

  async saveSettings(input: SaveSettingsInput): Promise<void> {
    const data = {
      defaultMarginBps: input.defaultMarginBps,
      roundingStrategy: input.roundingStrategy,
      alertThresholdBps: input.alertThresholdBps,
      cardFees: serializeCardFees(input.cardFees),
      updatedById: input.updatedById,
      updatedAt: new Date(),
    };
    await getDb().pricingSettings.upsert({ where: { id: "default" }, create: { id: "default", ...data }, update: data });
  }

  listExpenses(): Promise<PricingExpenseRecord[]> {
    return getDb().pricingExpense.findMany({ select: expenseSelect, orderBy: [{ position: "asc" }, { createdAt: "asc" }, { id: "asc" }] });
  }

  findExpense(id: string): Promise<PricingExpenseRecord | null> {
    return getDb().pricingExpense.findUnique({ where: { id }, select: expenseSelect });
  }

  async createExpense(input: { name: string; percentBps: number; active: boolean }): Promise<PricingExpenseRecord> {
    const db = getDb();
    const last = await db.pricingExpense.aggregate({ _max: { position: true } });
    return db.pricingExpense.create({
      data: { ...input, position: (last._max.position ?? -1) + 1 },
      select: expenseSelect,
    });
  }

  async updateExpense(
    id: string,
    input: { name: string; percentBps: number; active: boolean; position?: number },
  ): Promise<void> {
    await getDb().pricingExpense.update({ where: { id }, data: input });
  }

  async deleteExpense(id: string): Promise<void> {
    await getDb().pricingExpense.delete({ where: { id } });
  }

  async setTargetMargin(level: TargetMarginLevel, id: string, bps: number | null): Promise<boolean> {
    const db = getDb();
    const args = { where: { id }, data: { targetMarginBps: bps } };
    const result =
      level === "category"
        ? await db.category.updateMany(args)
        : level === "product"
          ? await db.product.updateMany(args)
          : await db.productVariant.updateMany(args);
    return result.count > 0;
  }
}
