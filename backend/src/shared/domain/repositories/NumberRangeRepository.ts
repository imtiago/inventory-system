import { Prisma } from "@prisma/client";

export interface NumberRangeRepository {
  getNextValue(name: string, tx?: Prisma.TransactionClient): Promise<number>;
}
