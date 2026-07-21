import { Prisma } from "@prisma/client";
import { prisma } from "@shared/prisma";

import { NumberRangeRepository } from "@shared/domain/repositories/NumberRangeRepository";

export class PrismaNumberRangeRepository implements NumberRangeRepository {
  async getNextValue(
    name: string,
    tx: Prisma.TransactionClient = prisma,
  ): Promise<number> {
    const result = await tx.numberRange.update({
      where: {
        name,
      },

      data: {
        currentValue: {
          increment: 1,
        },
      },

      select: {
        currentValue: true,
      },
    });

    return result.currentValue;
  }
}
