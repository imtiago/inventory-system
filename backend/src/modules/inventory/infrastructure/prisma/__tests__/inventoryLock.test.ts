import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import Fastify from "fastify";
import { Prisma } from "@prisma/client";
import { prisma } from "@shared/prisma";
import { InternalInvariantError } from "@shared/domain/errors";
import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";
import { getDb } from "@shared/infrastructure/prisma/transactionContext";
import { registerErrorHandling } from "@shared/http/errorHandler";
import { createTestVariant } from "../../../../../test/inventoryFixtures";
import { PrismaInventoryRepository } from "../repositories/PrismaInventoryRepository";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const CONCURRENT_BODY = {
  message: "Operação em andamento para este item. Tente novamente.",
  code: "CONCURRENT_UPDATE",
};

async function respondWith(error: unknown) {
  const app = Fastify();
  registerErrorHandling(app);
  app.get("/boom", async () => {
    throw error;
  });
  const res = await app.inject({ method: "GET", url: "/boom" });
  await app.close();
  return res;
}

describe("trava de linha de inventário", () => {
  const repo = new PrismaInventoryRepository();
  const tm = new PrismaTransactionManager();
  const cleanups: Array<() => Promise<void>> = [];

  async function newVariant() {
    const v = await createTestVariant();
    cleanups.push(v.cleanup);
    return v.variantId;
  }

  after(async () => {
    for (const c of cleanups) await c();
    await prisma.$disconnect();
  });

  test("lock fora de transação lança InternalInvariantError", async () => {
    const variantId = await newVariant();
    await assert.rejects(
      () => repo.lockByProductVariantId(variantId),
      (e: unknown) => e instanceof InternalInvariantError && e.code === "LOCK_OUTSIDE_TRANSACTION",
    );
    await assert.rejects(
      () => repo.lockExistingByProductVariantId(variantId),
      (e: unknown) => e instanceof InternalInvariantError && e.code === "LOCK_OUTSIDE_TRANSACTION",
    );
  });

  test("lockByProductVariantId cria inventário vazio se não existe e retorna o existente se existe", async () => {
    const variantId = await newVariant();
    const first = await tm.execute(() => repo.lockByProductVariantId(variantId));
    assert.equal(first.productVariantId, variantId);
    assert.equal(first.quantity, 0);
    const second = await tm.execute(() => repo.lockByProductVariantId(variantId));
    assert.equal(second.id, first.id);
    assert.equal(await prisma.inventory.count({ where: { productVariantId: variantId } }), 1);
  });

  test("lockExisting… retorna null sem criar quando não existe", async () => {
    const variantId = await newVariant();
    const r = await tm.execute(() => repo.lockExistingByProductVariantId(variantId));
    assert.equal(r, null);
    assert.equal(await prisma.inventory.count({ where: { productVariantId: variantId } }), 0);
    await tm.execute(() => repo.lockByProductVariantId(variantId));
    const r2 = await tm.execute(() => repo.lockExistingByProductVariantId(variantId));
    assert.equal(r2?.productVariantId, variantId);
  });

  test("trava segura a 2ª transação até o commit da 1ª", async () => {
    const variantId = await newVariant();
    await tm.execute(() => repo.lockByProductVariantId(variantId));
    let release!: () => void;
    const locked = new Promise<void>((r) => (release = r));
    const t1 = tm.execute(async () => {
      const inv = await repo.lockByProductVariantId(variantId);
      release();
      await sleep(300);
      inv.receive({ quantity: 5, unitCost: 1 });
      await repo.update(inv);
    });
    await locked;
    const start = Date.now();
    const seen = await tm.execute(async () => {
      const inv = await repo.lockByProductVariantId(variantId);
      return inv.quantity;
    });
    const elapsed = Date.now() - start;
    await t1;
    assert.ok(elapsed >= 250, `esperava >= 250ms, foi ${elapsed}`);
    assert.equal(seen, 5);
  });

  test("lockTimeoutMs curto + trava segurada → rejeita e o handler responde 409 CONCURRENT_UPDATE", async () => {
    const variantId = await newVariant();
    await tm.execute(() => repo.lockByProductVariantId(variantId));
    const tm2 = new PrismaTransactionManager({ lockTimeoutMs: 200 });
    let release!: () => void;
    const locked = new Promise<void>((r) => (release = r));
    const t1 = tm.execute(async () => {
      await repo.lockByProductVariantId(variantId);
      release();
      await sleep(800);
    });
    await locked;
    let captured: unknown;
    try {
      await tm2.execute(() => repo.lockByProductVariantId(variantId));
    } catch (e) {
      captured = e;
    }
    await t1;
    assert.ok(captured, "esperava erro de lock timeout");
    const app = Fastify();
    registerErrorHandling(app);
    app.get("/boom", async () => {
      throw captured;
    });
    const res = await app.inject({ method: "GET", url: "/boom" });
    await app.close();
    assert.equal(res.statusCode, 409);
    assert.deepEqual(res.json(), {
      message: "Operação em andamento para este item. Tente novamente.",
      code: "CONCURRENT_UPDATE",
    });
  });

  test("deadlock real → 409 CONCURRENT_UPDATE", async () => {
    const a = await newVariant();
    const b = await newVariant();
    await tm.execute(() => repo.lockByProductVariantId(a));
    await tm.execute(() => repo.lockByProductVariantId(b));
    const tmx = new PrismaTransactionManager({ lockTimeoutMs: 5000 });
    const t1 = tmx.execute(async () => {
      await repo.lockByProductVariantId(a);
      await sleep(300);
      await repo.lockByProductVariantId(b);
    });
    const t2 = tmx.execute(async () => {
      await repo.lockByProductVariantId(b);
      await sleep(300);
      await repo.lockByProductVariantId(a);
    });
    const results = await Promise.allSettled([t1, t2]);
    const rejected = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
    assert.equal(rejected.length, 1);
    const app = Fastify();
    registerErrorHandling(app);
    app.get("/boom", async () => {
      throw rejected[0].reason;
    });
    const res = await app.inject({ method: "GET", url: "/boom" });
    await app.close();
    assert.equal(res.statusCode, 409);
    assert.equal(res.json().code, "CONCURRENT_UPDATE");
  });

  test("lock timeout em query Prisma comum (não-raw) → 409 CONCURRENT_UPDATE", async () => {
    const variantId = await newVariant();
    await tm.execute(() => repo.lockByProductVariantId(variantId));
    let release!: () => void;
    const locked = new Promise<void>((r) => (release = r));
    const t1 = tm.execute(async () => {
      await repo.lockByProductVariantId(variantId);
      release();
      await sleep(800);
    });
    await locked;
    let captured: unknown;
    try {
      await new PrismaTransactionManager({ lockTimeoutMs: 200 }).execute(async () => {
        await getDb().inventory.update({
          where: { productVariantId: variantId },
          data: { reservedQuantity: 0 },
        });
      });
    } catch (e) {
      captured = e;
    }
    await t1;
    assert.ok(captured, "esperava erro de lock timeout");
    assert.ok(captured instanceof Prisma.PrismaClientUnknownRequestError);
    const res = await respondWith(captured);
    assert.equal(res.statusCode, 409);
    assert.deepEqual(res.json(), CONCURRENT_BODY);
  });

  test("expiração da transação interativa (P2028) → 409 CONCURRENT_UPDATE", async () => {
    let captured: unknown;
    try {
      await new PrismaTransactionManager({ timeout: 300 }).execute(async () => {
        await sleep(600);
        await getDb().inventory.count();
      });
    } catch (e) {
      captured = e;
    }
    assert.ok(captured instanceof Prisma.PrismaClientKnownRequestError);
    assert.equal(captured.code, "P2028");
    assert.match(String((captured.meta as any)?.error), /expired transaction/);
    const res = await respondWith(captured);
    assert.equal(res.statusCode, 409);
    assert.deepEqual(res.json(), CONCURRENT_BODY);
  });

  test("transação sem trava não é afetada pelo lock_timeout (leitura simples com a linha travada)", async () => {
    const variantId = await newVariant();
    await tm.execute(() => repo.lockByProductVariantId(variantId));
    let release!: () => void;
    const locked = new Promise<void>((r) => (release = r));
    let free!: () => void;
    const hold = new Promise<void>((r) => (free = r));
    const t1 = tm.execute(async () => {
      await repo.lockByProductVariantId(variantId);
      release();
      await hold;
    });
    await locked;
    try {
      const start = Date.now();
      const found = await new PrismaTransactionManager({ lockTimeoutMs: 200 }).execute(() =>
        repo.findByProductVariantId(variantId),
      );
      assert.equal(found?.productVariantId, variantId);
      assert.ok(Date.now() - start < 150, "SELECT simples não deve esperar a trava");
    } finally {
      free();
      await t1;
    }
  });

  test("lote duplicado (variante+batchNumber) → P2002", async () => {
    const variantId = await newVariant();
    const inv = await prisma.inventory.create({ data: { productVariantId: variantId } });
    const data = {
      inventoryId: inv.id,
      productVariantId: variantId,
      sourceType: "MANUAL" as const,
      initialQuantity: 1,
      remainingQuantity: 1,
      unitCost: 1,
      batchNumber: "LOTE-X",
    };
    await prisma.inventoryLot.create({ data });
    await assert.rejects(
      () => prisma.inventoryLot.create({ data }),
      (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002",
    );
  });
});
