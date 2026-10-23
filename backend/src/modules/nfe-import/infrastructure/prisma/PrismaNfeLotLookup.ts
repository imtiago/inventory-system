import { getDb } from "@shared/infrastructure/prisma/transactionContext";
import { NfeLotLookup } from "@nfe-import/application/contracts/NfeLotLookup";

export class PrismaNfeLotLookup implements NfeLotLookup {
  async findExistingBatchNumbers(productVariantId: string, batchNumbers: string[]): Promise<string[]> {
    if (batchNumbers.length === 0) return [];
    const rows = await getDb().inventoryLot.findMany({
      where: { productVariantId, batchNumber: { in: batchNumbers } },
      select: { batchNumber: true },
    });
    return rows.flatMap((r) => (r.batchNumber === null ? [] : [r.batchNumber]));
  }
}
