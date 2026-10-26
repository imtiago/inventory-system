import { getDb } from "@shared/infrastructure/prisma/transactionContext";
import type { TargetMarginLevels, TargetMarginReader } from "@pricing/application/contracts/TargetMarginReader";

export class PrismaTargetMarginReader implements TargetMarginReader {
  async forVariant(variantId: string): Promise<TargetMarginLevels> {
    const v = await getDb().productVariant.findUnique({
      where: { id: variantId },
      select: {
        targetMarginBps: true,
        product: { select: { targetMarginBps: true, category: { select: { targetMarginBps: true } } } },
      },
    });
    return {
      variant: v?.targetMarginBps ?? null,
      product: v?.product.targetMarginBps ?? null,
      category: v?.product.category.targetMarginBps ?? null,
    };
  }
}
