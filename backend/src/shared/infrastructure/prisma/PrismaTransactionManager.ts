import { prisma } from "@shared/prisma";
import { TransactionManager } from "@shared/application/transaction/TransactionManager";
import {
  hasActiveTransaction,
  runInTransactionContext,
} from "./transactionContext";

interface PrismaTransactionManagerOptions {
  timeout?: number;
  maxWait?: number;
  lockTimeoutMs?: number;
}

export class PrismaTransactionManager implements TransactionManager {
  private readonly timeout: number;
  private readonly maxWait: number;
  private readonly lockTimeoutMs: number;

  constructor(options: PrismaTransactionManagerOptions = {}) {
    this.timeout = options.timeout ?? 10000;
    this.maxWait = options.maxWait ?? 2000;
    const lockTimeoutMs = options.lockTimeoutMs ?? 5000;
    if (!Number.isInteger(lockTimeoutMs) || lockTimeoutMs <= 0) {
      throw new RangeError("lockTimeoutMs deve ser um inteiro positivo.");
    }
    this.lockTimeoutMs = lockTimeoutMs;
  }

  async execute<T>(work: () => Promise<T>): Promise<T> {
    // Já dentro de uma transação: participa dela (a mais externa faz o commit).
    if (hasActiveTransaction()) {
      return work();
    }

    return prisma.$transaction(
      async (tx) => {
        // lockTimeoutMs é inteiro positivo validado no construtor (não é entrada do usuário).
        await tx.$executeRawUnsafe(`SET LOCAL lock_timeout = '${this.lockTimeoutMs}ms'`);
        return runInTransactionContext(tx, work);
      },
      { timeout: this.timeout, maxWait: this.maxWait },
    );
  }
}
