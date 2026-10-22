import { AsyncLocalStorage } from "node:async_hooks";
import { Prisma } from "@prisma/client";
import { prisma } from "@shared/prisma";

const storage = new AsyncLocalStorage<Prisma.TransactionClient>();

/**
 * Client da transação ativa no contexto assíncrono atual,
 * ou o client global quando não há transação.
 */
export function getDb(): Prisma.TransactionClient {
  return storage.getStore() ?? prisma;
}

export function hasActiveTransaction(): boolean {
  return storage.getStore() !== undefined;
}

export function runInTransactionContext<T>(
  tx: Prisma.TransactionClient,
  work: () => Promise<T>,
): Promise<T> {
  return storage.run(tx, work);
}
