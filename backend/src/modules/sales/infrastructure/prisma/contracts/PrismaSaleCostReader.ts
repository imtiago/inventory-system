import { toCost4, type Cost4 } from "@shared/domain/cost4";
import { getDb } from "@shared/infrastructure/prisma/transactionContext";
import { SaleCostReader } from "@sales/application/contracts/SaleCostReader";

export class PrismaSaleCostReader implements SaleCostReader {
  async averageCosts(variantIds: string[]): Promise<Map<string, Cost4>> {
    if (variantIds.length === 0) return new Map();
    const rows = await getDb().inventory.findMany({
      where: { productVariantId: { in: variantIds } },
      select: { productVariantId: true, averageCost: true },
    });
    return new Map(rows.map((r) => [r.productVariantId, toCost4(Number(r.averageCost))]));
  }
}
