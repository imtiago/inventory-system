import { getDb } from "@shared/infrastructure/prisma/transactionContext";

import { NumberRangeRepository } from "@shared/domain/repositories/NumberRangeRepository";

export class PrismaNumberRangeRepository implements NumberRangeRepository {
  async getNextValue(
    name: string
  ): Promise<number> {
    const result = await getDb().numberRange.update({
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
