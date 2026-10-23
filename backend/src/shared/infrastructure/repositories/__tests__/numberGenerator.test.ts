import { after, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "@shared/prisma";
import { PrismaNumberRangeRepository } from "@shared/infrastructure/repositories/PrismaNumberRangeRepository";
import { SequentialNumberGenerator } from "@shared/application/services/SequentialNumberGenerator";
import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";

const createdNames: string[] = [];
const rangeName = () => {
  const n = `TEST_RANGE_${randomUUID()}`;
  createdNames.push(n);
  return n;
};

describe("numeração sob demanda", () => {
  const generator = new SequentialNumberGenerator(
    new PrismaNumberRangeRepository(),
  );

  after(async () => {
    await prisma.numberRange.deleteMany({ where: { name: { in: createdNames } } });
    await prisma.$disconnect();
  });

  test("gera número quando a faixa não existe (cria sob demanda)", async () => {
    const name = rangeName();
    assert.equal(await prisma.numberRange.count({ where: { name } }), 0);

    assert.equal(await generator.generate(name, "X"), "X000001");
    assert.equal(await generator.generate(name, "X"), "X000002");
  });

  test("duas gerações simultâneas numa faixa inexistente → números distintos, sem erro", async () => {
    const name = rangeName();

    const results = await Promise.all(
      Array.from({ length: 5 }, () => generator.generate(name, "Y")),
    );

    assert.equal(new Set(results).size, 5);
    assert.deepEqual([...results].sort(), [
      "Y000001",
      "Y000002",
      "Y000003",
      "Y000004",
      "Y000005",
    ]);
  });

  test("participa da transação: rollback desfaz a criação da faixa", async () => {
    const name = rangeName();
    const tm = new PrismaTransactionManager();

    await assert.rejects(
      tm.execute(async () => {
        await generator.generate(name, "Z");
        throw new Error("boom");
      }),
      /boom/,
    );

    assert.equal(await prisma.numberRange.count({ where: { name } }), 0);
  });
});
