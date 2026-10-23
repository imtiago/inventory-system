import { randomUUID } from "node:crypto";
import { getDb } from "@shared/infrastructure/prisma/transactionContext";

import { NumberRangeRepository } from "@shared/domain/repositories/NumberRangeRepository";

export class PrismaNumberRangeRepository implements NumberRangeRepository {
  /**
   * Incrementa a faixa criando-a sob demanda. Um único INSERT ... ON CONFLICT
   * é atômico: chamadas simultâneas numa faixa inexistente não colidem, e
   * participa da transação ativa (getDb).
   */
  async getNextValue(name: string): Promise<number> {
    const rows = await getDb().$queryRaw<{ currentValue: number }[]>`
      INSERT INTO "NumberRange" ("id", "name", "currentValue", "updatedAt")
      VALUES (${randomUUID()}, ${name}, 1, NOW())
      ON CONFLICT ("name") DO UPDATE
        SET "currentValue" = "NumberRange"."currentValue" + 1,
            "updatedAt" = NOW()
      RETURNING "currentValue"
    `;

    const row = rows[0];
    if (!row) {
      throw new Error(`Falha ao gerar número da faixa ${name}`);
    }

    return row.currentValue;
  }
}
