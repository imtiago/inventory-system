import "dotenv/config";
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "@shared/prisma";
import { app } from "../../../../../app";
import { createTestUser, TestUser } from "../../../../../test/authFixtures";
import { createTestVariant } from "../../../../../test/inventoryFixtures";

app.log.level = "silent";

// Janela exclusiva deste arquivo (mesma convenção do relatório CSV).
const FROM = "2095-07-09";
const TO = "2095-07-11";

describe("GET /sales com período e status", () => {
  let admin: TestUser;
  let customerId: string;
  let variantId: string;
  let cleanupVariant: () => Promise<void>;
  let saleA: string; // 23:30 BRT do dia 09
  let saleB: string;
  let saleC: string; // cancelada, dia 11
  let outside: string;
  const tag = `tx-test-${randomUUID()}`;

  const get = (qs: string) =>
    app.inject({ method: "GET", url: `/sales${qs}`, headers: { authorization: `Bearer ${admin.token}` } });
  const ids = async (qs: string) => {
    const res = await get(qs);
    assert.equal(res.statusCode, 200, res.body);
    return res.json().data.map((s: { id: string }) => s.id) as string[];
  };

  before(async () => {
    admin = await createTestUser({ role: "ADMIN" });
    customerId = (await prisma.customer.create({ data: { name: tag, code: tag } })).id;
    const v = await createTestVariant();
    variantId = v.variantId;
    cleanupVariant = v.cleanup;
    const mk = async (createdAt: string, status: "COMPLETED" | "CANCELED") =>
      (
        await prisma.sale.create({
          data: {
            customerId,
            status,
            totalAmount: 10,
            createdAt: new Date(createdAt),
            items: { create: [{ productVariantId: variantId, productName: "P", quantity: 1, unitPrice: 10 }] },
          },
        })
      ).id;
    saleA = await mk("2095-07-10T02:30:00.000Z", "COMPLETED");
    saleB = await mk("2095-07-10T12:00:00.000Z", "COMPLETED");
    saleC = await mk("2095-07-11T15:00:00.000Z", "CANCELED");
    outside = await mk("2095-08-20T15:00:00.000Z", "COMPLETED");
  });

  after(async () => {
    try {
      await prisma.sale.deleteMany({ where: { customerId } });
      await cleanupVariant();
      await prisma.customer.deleteMany({ where: { id: customerId } });
      await admin.cleanup();
    } finally {
      try {
        await app.close();
      } finally {
        await prisma.$disconnect();
      }
    }
  });

  test("filtra pelo período em dias de negócio (BRT)", async () => {
    const all = await ids(`?from=${FROM}&to=${TO}&limit=100`);
    assert.deepEqual(new Set(all), new Set([saleA, saleB, saleC]));
    assert.deepEqual(await ids(`?from=2095-07-10&to=2095-07-10&limit=100`), [saleB]);
    assert.deepEqual(await ids(`?from=2095-07-09&to=2095-07-09&limit=100`), [saleA]);
  });

  test("filtra por status e o total da paginação respeita o filtro", async () => {
    const res = await get(`?from=${FROM}&to=${TO}&status=CANCELED`);
    assert.equal(res.statusCode, 200, res.body);
    assert.deepEqual(res.json().data.map((s: { id: string }) => s.id), [saleC]);
    assert.equal(res.json().pagination.total, 1);
    const page = await get(`?from=${FROM}&to=${TO}&limit=2`);
    assert.equal(page.json().pagination.total, 3);
  });

  test("mesmas regras de validação do relatório CSV", async () => {
    assert.equal((await get(`?from=2095-07-11&to=2095-07-09`)).statusCode, 400);
    assert.equal((await get(`?from=2095-01-01&to=2096-12-31`)).statusCode, 400);
    assert.equal((await get(`?from=2095-07-01&to=2095-07-02&status=XX`)).statusCode, 400);
    assert.equal((await get(`?from=2095-02-31&to=2095-03-02`)).statusCode, 400);
    assert.equal((await get(`?from=2095-07-01`)).statusCode, 400);
  });

  test("sem período continua listando tudo (compatibilidade)", async () => {
    const res = await get(`?limit=100`);
    assert.equal(res.statusCode, 200, res.body);
  });
});
