import { prisma } from "@shared/prisma";
import { TransactionManager } from "@shared/application/transaction/TransactionManager";
import {
  hasActiveTransaction,
  runInTransactionContext,
} from "./transactionContext";

interface PrismaTransactionManagerOptions {
  timeout?: number;
  maxWait?: number;
}

export class PrismaTransactionManager implements TransactionManager {
  private readonly timeout: number;
  private readonly maxWait: number;

  constructor(options: PrismaTransactionManagerOptions = {}) {
    this.timeout = options.timeout ?? 10000;
    this.maxWait = options.maxWait ?? 2000;
  }

  async execute<T>(work: () => Promise<T>): Promise<T> {
    // Já dentro de uma transação: participa dela (a mais externa faz o commit).
    if (hasActiveTransaction()) {
      return work();
    }

    return prisma.$transaction(
      (tx) => runInTransactionContext(tx, work),
      { timeout: this.timeout, maxWait: this.maxWait },
    );
  }
}
