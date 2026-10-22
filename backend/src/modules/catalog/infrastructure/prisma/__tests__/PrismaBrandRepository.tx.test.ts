import { after, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "@shared/prisma";
import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";
import { PrismaBrandRepository } from "@catalog/infrastructure/prisma/repositories/PrismaBrandRepository";
import { Brand } from "@catalog/domain/entities/Brand";

describe("PrismaBrandRepository dentro de transação", () => {
  const createdNames: string[] = [];
  after(async () => {
    await prisma.brand.deleteMany({ where: { name: { in: createdNames } } });
    await prisma.$disconnect();
  });

  test("repositório participa da transação", async () => {
    const repo = new PrismaBrandRepository();
    const tm = new PrismaTransactionManager();
    const name = `tx-test-${randomUUID()}`;
    createdNames.push(name);

    await assert.rejects(
      tm.execute(async () => {
        await repo.create(new Brand({ name }));
        throw new Error("boom");
      }),
      /boom/,
    );

    assert.equal(await prisma.brand.count({ where: { name } }), 0);
  });
});
