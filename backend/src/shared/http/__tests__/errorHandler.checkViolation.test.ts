import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { Prisma } from "@prisma/client";
import { prisma } from "@shared/prisma";
import { deleteFinancialDocuments } from "../../../test/cleanup";
import { registerErrorHandling } from "../errorHandler";
import { createTestVariant } from "../../../test/inventoryFixtures";

async function call(thrower: () => unknown | Promise<unknown>) {
  const app = Fastify();
  registerErrorHandling(app);
  app.log.level = "silent";
  app.get("/boom", async () => {
    throw await thrower();
  });
  const res = await app.inject({ method: "GET", url: "/boom" });
  await app.close();
  return { status: res.statusCode, body: res.json() };
}

const CONSTRAINT = {
  message: "Operação recusada: deixaria dados inconsistentes.",
  code: "CONSTRAINT_VIOLATION",
};

test("CHECK violado em query raw (P2010 meta.code 23514) → 409 CONSTRAINT_VIOLATION", async () => {
  const r = await call(
    () =>
      new Prisma.PrismaClientKnownRequestError("Raw query failed", {
        code: "P2010",
        clientVersion: "6",
        meta: { code: "23514", message: "violates check constraint" },
      }),
  );
  assert.equal(r.status, 409);
  assert.deepEqual(r.body, CONSTRAINT);
});

test("CHECK violado em query comum (erro desconhecido com PostgresError 23514) → 409 CONSTRAINT_VIOLATION", async () => {
  const r = await call(
    () =>
      new Prisma.PrismaClientUnknownRequestError(
        'Invalid `prisma.inventory.update()` invocation: PostgresError { code: "23514", message: "new row violates check constraint" }',
        { clientVersion: "6" },
      ),
  );
  assert.equal(r.status, 409);
  assert.deepEqual(r.body, CONSTRAINT);
});

test("23514 solto na mensagem (UUID/valor em detail) não vira CONSTRAINT_VIOLATION", async () => {
  const r = await call(
    () =>
      new Prisma.PrismaClientUnknownRequestError(
        'PostgresError { code: "XX000", detail: "Key (id)=(a1-23514-b2) falhou" }',
        { clientVersion: "6" },
      ),
  );
  assert.equal(r.status, 500);
  const known = await call(
    () =>
      new Prisma.PrismaClientKnownRequestError("Raw query failed 23514", {
        code: "P2010",
        clientVersion: "6",
        meta: { code: "40001" },
      }),
  );
  assert.notEqual(known.body.code, "CONSTRAINT_VIOLATION");
});

test("gravação real que viola o CHECK de estoque → 409 CONSTRAINT_VIOLATION", async () => {
  const { variantId, cleanup } = await createTestVariant();
  try {
    const orm = await call(() =>
      prisma.inventory.create({ data: { productVariantId: variantId, quantity: -1, averageCost: 1 } }).then(
        () => new Error("deveria falhar"),
        (e) => e,
      ),
    );
    assert.deepEqual(orm.body, CONSTRAINT);
    assert.equal(orm.status, 409);

    await prisma.inventory.create({ data: { productVariantId: variantId, quantity: 5, averageCost: 1 } });
    const raw = await call(() =>
      prisma.$executeRaw`UPDATE "Inventory" SET "reservedQuantity" = 6 WHERE "productVariantId" = ${variantId}`.then(
        () => new Error("deveria falhar"),
        (e) => e,
      ),
    );
    assert.deepEqual(raw.body, CONSTRAINT);
    assert.equal(raw.status, 409);
  } finally {
    await cleanup();
  }
});

test("segunda origem financeira ativa para a mesma venda → 409 CONSTRAINT_VIOLATION", async () => {
  const originId = `tx-test-${crypto.randomUUID()}`;
  const data = {
    type: "RECEIVABLE" as const,
    originType: "SALE" as const,
    originId,
    partyId: "p",
    partyType: "CUSTOMER" as const,
  };
  const first = await prisma.financialDocument.create({ data });
  try {
    const dup = await call(() =>
      prisma.financialDocument.create({ data }).then(
        () => new Error("deveria falhar"),
        (e) => e,
      ),
    );
    assert.equal(dup.status, 409);
    // Duplicata de origem é P2002 (índice único), resposta genérica já existente.
    assert.equal(dup.body.code, "CONFLICT");
    // Cancelado não conta: pode haver novo ativo.
    await prisma.financialDocument.update({ where: { id: first.id }, data: { status: "CANCELED" } });
    const second = await prisma.financialDocument.create({ data });
    await prisma.financialDocument.delete({ where: { id: second.id } });
  } finally {
    await deleteFinancialDocuments({ where: { originId } });
  }
});
