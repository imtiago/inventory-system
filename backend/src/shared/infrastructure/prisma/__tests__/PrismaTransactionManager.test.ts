import { after, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "@shared/prisma";
import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";
import { getDb } from "@shared/infrastructure/prisma/transactionContext";

const brandName = () => `tx-test-${randomUUID()}`;
const countBrands = (name: string) => prisma.brand.count({ where: { name } });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("PrismaTransactionManager", () => {
  const tm = new PrismaTransactionManager();

  after(async () => {
    await prisma.brand.deleteMany({ where: { name: { startsWith: "tx-test-" } } });
    await prisma.$disconnect();
  });

  test("rollback: erro após escrita não deixa registro", async () => {
    const name = brandName();
    const err = new Error("boom");

    let caught: unknown;
    try {
      await tm.execute(async () => {
        await getDb().brand.create({ data: { name } });
        throw err;
      });
    } catch (e) {
      caught = e;
    }

    assert.equal(caught, err);
    assert.equal(await countBrands(name), 0);
  });

  test("commit: sem erro o registro existe", async () => {
    const name = brandName();

    await tm.execute(async () => {
      await getDb().brand.create({ data: { name } });
    });

    assert.equal(await countBrands(name), 1);
  });

  test("aninhado reaproveita a transação", async () => {
    const outerName = brandName();
    const innerName = brandName();

    await assert.rejects(
      tm.execute(async () => {
        const outerDb = getDb();
        await outerDb.brand.create({ data: { name: outerName } });

        await tm.execute(async () => {
          assert.equal(getDb(), outerDb);
          await getDb().brand.create({ data: { name: innerName } });
          throw new Error("inner");
        });
      }),
      /inner/,
    );

    assert.equal(await countBrands(outerName), 0);
    assert.equal(await countBrands(innerName), 0);
  });

  test("fora de execute, getDb() é o client global", async () => {
    assert.equal(getDb(), prisma);

    await tm.execute(async () => {
      assert.notEqual(getDb(), prisma);
    });
    assert.equal(getDb(), prisma);

    await assert.rejects(
      tm.execute(async () => {
        throw new Error("x");
      }),
    );
    assert.equal(getDb(), prisma);
  });

  test("execuções concorrentes não compartilham contexto", async () => {
    const capture = () =>
      tm.execute(async () => {
        await sleep(50);
        return getDb();
      });

    const [dbA, dbB] = await Promise.all([capture(), capture()]);

    assert.notEqual(dbA, dbB);
    assert.notEqual(dbA, prisma);
    assert.notEqual(dbB, prisma);
  });

  test("timeout rejeita e desfaz", async () => {
    const shortTm = new PrismaTransactionManager({ timeout: 200 });
    const name = brandName();

    await assert.rejects(
      shortTm.execute(async () => {
        await getDb().brand.create({ data: { name } });
        await sleep(500);
      }),
    );

    assert.equal(await countBrands(name), 0);
  });
});
