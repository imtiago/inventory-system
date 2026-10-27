import { getDb } from "@shared/infrastructure/prisma/transactionContext";
import { toCents } from "@shared/domain/money";
import { toCost4 } from "@shared/domain/cost4";
import type { VariantPricingReader, VariantPricingSource } from "@pricing/application/contracts/VariantPricingRepository";

export class PrismaVariantPricingReader implements VariantPricingReader {
  async find(variantId: string): Promise<VariantPricingSource | null> {
    const v = await getDb().productVariant.findUnique({
      where: { id: variantId },
      select: {
        id: true,
        salePrice: true,
        supplierSuggestedPrice: true,
        supplierSuggestedPriceUpdatedAt: true,
        inventory: { select: { averageCost: true } },
      },
    });
    if (!v) return null;
    return {
      variantId: v.id,
      salePriceCents: toCents(Number(v.salePrice)),
      averageCost4: toCost4(Number(v.inventory?.averageCost ?? 0)),
      supplierPriceCents: v.supplierSuggestedPrice === null ? null : toCents(Number(v.supplierSuggestedPrice)),
      supplierPriceUpdatedAt: v.supplierSuggestedPriceUpdatedAt,
    };
  }
}
