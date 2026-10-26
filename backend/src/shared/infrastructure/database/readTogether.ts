import type { PrismaPromise } from "@prisma/client";
import { prisma } from "@shared/prisma";
import { hasActiveTransaction } from "@shared/infrastructure/prisma/transactionContext";

type Results<T extends readonly PrismaPromise<unknown>[]> = { -readonly [K in keyof T]: Awaited<T[K]> };

/**
 * Executa leituras do Prisma (ex.: página + contagem) numa só conexão.
 *
 * `Promise.all` de duas consultas fora de transação ocupa duas conexões do pool; sob carga isso
 * esgota o pool. Aqui:
 * - dentro de uma transação, as consultas rodam em sequência na conexão dela;
 * - fora, vão num lote `$transaction([...])`, que usa uma conexão só.
 * Só aceita consultas do Prisma (lazy): `findMany`, `count`, `$queryRaw`…
 */
export async function readTogether<const T extends readonly PrismaPromise<unknown>[]>(
  queries: T,
): Promise<Results<T>> {
  if (queries.length === 0) return [] as unknown as Results<T>;
  if (hasActiveTransaction()) {
    const results: unknown[] = [];
    for (const query of queries) results.push(await query);
    return results as Results<T>;
  }
  return (await prisma.$transaction([...queries])) as Results<T>;
}
