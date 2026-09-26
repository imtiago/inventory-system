import { PrismaClient } from "@prisma/client";
import { TransactionManager } from "@shared/application/transaction/TransactionManager";

export class PrismaTransactionManager implements TransactionManager {
  constructor(private readonly prisma: PrismaClient) {}

  async execute<T>(callback: () => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async () => {
      return callback();
    });
  }
}
