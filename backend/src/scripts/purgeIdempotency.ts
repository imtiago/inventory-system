// src/scripts/purgeIdempotency.ts
// Remove registros de idempotência com mais de 24 h. Uso:
//   npm run purge-idempotency
// (A API também remove lotes de registros vencidos de forma preguiçosa.)
import "dotenv/config";
import { pathToFileURL } from "node:url";
import { prisma } from "@shared/prisma";
import {
  IDEMPOTENCY_RETENTION_HOURS,
  PrismaIdempotencyStore,
} from "@shared/http/idempotency/PrismaIdempotencyStore";

/** Remove em lotes todos os registros vencidos; devolve quantos removeu. */
export async function purgeIdempotencyRecords(
  options: { retentionHours?: number; batchSize?: number } = {},
): Promise<number> {
  const store = new PrismaIdempotencyStore();
  const batchSize = options.batchSize ?? 1000;
  const retentionHours = options.retentionHours ?? IDEMPOTENCY_RETENTION_HOURS;
  let total = 0;
  for (;;) {
    const removed = await store.purgeExpired(batchSize, retentionHours);
    total += removed;
    if (removed < batchSize) return total;
  }
}

async function main(): Promise<void> {
  try {
    const removed = await purgeIdempotencyRecords();
    console.log(`Registros de idempotência removidos: ${removed}`);
  } catch (error) {
    console.error(`Falha ao remover registros de idempotência: ${(error as Error).message}`);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main();
}
