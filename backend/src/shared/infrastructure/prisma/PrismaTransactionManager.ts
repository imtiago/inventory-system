import { prisma } from "@shared/prisma";
import { TransactionManager } from "../../domain/TransactionManager";

export class PrismaTransactionManager implements TransactionManager {
  async execute<T>(callback: (tx: any) => Promise<T>): Promise<T> {
    return prisma.$transaction(async (tx) => {
      return callback(tx);
    });
  }
}
