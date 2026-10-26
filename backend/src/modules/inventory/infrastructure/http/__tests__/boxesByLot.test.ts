import "dotenv/config";
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "@shared/prisma";
import { app } from "../../../../../app";
import { createTestVariant, getTestUserId } from "../../../../../test/inventoryFixtures";
import { signTestToken } from "../../../../../test/authFixtures";

app.log.level = "silent";

describe("GET /inventory/boxes/by-lot é paginado", () => {
  const BOXES = 12;
  let token: string;
  let variantId: string;
  let cleanupVariant: () => Promise<void>;
  let batchNumber: string;
  const boxIds: string[] = [];

  const get = (query: string) =>
    app.inject({ method: "GET", url: `/inventory/boxes/by-lot?${query}`, headers: { authorization: `Bearer ${token}` } });

  before(async () => {
    token = signTestToken(await getTestUserId());
    ({ variantId, cleanup: cleanupVariant } = await createTestVariant());
    batchNumber = `tx-test-${randomUUID().slice(0, 8)}`;
    const inventory = await prisma.inventory.create({ data: { productVariantId: variantId, quantity: BOXES * 2 } });
    const lot = await prisma.inventoryLot.create({
      data: {
        inventoryId: inventory.id,
        productVariantId: variantId,
        sourceType: "MANUAL",
        initialQuantity: BOXES * 2,
        remainingQuantity: BOXES * 2,
        unitCost: 1,
        batchNumber,
      },
    });
    for (let i = 0; i < BOXES; i++) {
      const box = await prisma.inventoryBox.create({ data: { code: `tx-test-${randomUUID()}` } });
      boxIds.push(box.id);
      await prisma.inventoryBoxStock.create({ data: { inventoryLotId: lot.id, boxId: box.id, quantity: 2 } });
    }
  });

  after(async () => {
    try {
      await prisma.inventoryBoxStock.deleteMany({ where: { boxId: { in: boxIds } } });
      await prisma.inventoryBox.deleteMany({ where: { id: { in: boxIds } } });
    } finally {
      try {
        await cleanupVariant();
      } finally {
        await app.close();
        await prisma.$disconnect();
      }
    }
  });

  test("padrão: página 1 com 10 caixas e total correto; page=2 traz as demais, sem repetir", async () => {
    const base = `productVariantId=${variantId}&batchNumber=${encodeURIComponent(batchNumber)}`;
    const p1 = await get(base);
    assert.equal(p1.statusCode, 200, p1.body);
    assert.equal(p1.json().data.length, 10);
    assert.equal(p1.json().pagination.total, BOXES);

    const p2 = await get(`${base}&page=2`);
    assert.equal(p2.statusCode, 200, p2.body);
    assert.equal(p2.json().data.length, BOXES - 10);

    const ids = [...p1.json().data, ...p2.json().data].map((b: { id: string }) => b.id);
    assert.equal(new Set(ids).size, BOXES);
    assert.deepEqual([...ids].sort(), [...boxIds].sort());
  });

  test("limit=5 pagina de 5 em 5; limit acima de 100 → 400", async () => {
    const base = `productVariantId=${variantId}&batchNumber=${encodeURIComponent(batchNumber)}`;
    const res = await get(`${base}&limit=5&page=3`);
    assert.equal(res.statusCode, 200, res.body);
    assert.equal(res.json().data.length, 2);
    assert.equal((await get(`${base}&limit=101`)).statusCode, 400);
  });
});
