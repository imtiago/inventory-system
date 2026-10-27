import { getDb } from "@shared/infrastructure/prisma/transactionContext";
import { fromCents } from "@shared/domain/money";
import type { VariantPricingWriter } from "@pricing/application/contracts/VariantPricingRepository";

export class PrismaVariantPricingWriter implements VariantPricingWriter {
  async lockVariant(variantId: string): Promise<boolean> {
    const rows = await getDb().$queryRaw<{ id: string }[]>`
      SELECT id FROM "ProductVariant" WHERE id = ${variantId} FOR UPDATE`;
    return rows.length > 0;
  }

  async setSupplierPrice(variantId: string, cents: number | null): Promise<void> {
    await getDb().productVariant.update({
      where: { id: variantId },
      data: {
        supplierSuggestedPrice: cents === null ? null : fromCents(cents),
        supplierSuggestedPriceUpdatedAt: cents === null ? null : new Date(),
      },
    });
  }

  async setSalePrice(variantId: string, cents: number): Promise<void> {
    await getDb().productVariant.update({ where: { id: variantId }, data: { salePrice: fromCents(cents) } });
  }
}
