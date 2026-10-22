import "dotenv/config";
import { after, afterEach, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import { prisma } from "@shared/prisma";
import { app } from "../../../../../app";
import { createTestVariant, getTestUserId } from "../../../../../test/inventoryFixtures";

app.log.level = "silent";

describe("Erros HTTP do estoque", () => {
  let variantId: string;
  let cleanupVariant: () => Promise<void>;
  let token: string;
  const boxIds: string[] = [];

  beforeEach(async () => {
    ({ variantId, cleanup: cleanupVariant } = await createTestVariant());
    token = jwt.sign({ sub: await getTestUserId(), role: "admin" }, process.env.JWT_SECRET!);
  });

  afterEach(async () => {
    const ids = boxIds.splice(0);
    try {
      await prisma.inventoryBoxStock.deleteMany({ where: { boxId: { in: ids } } });
    } finally {
      try {
        await cleanupVariant();
      } finally {
        await prisma.inventoryBox.deleteMany({ where: { id: { in: ids } } });
      }
    }
  });

  after(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  const call = (method: "GET" | "POST", url: string, payload?: unknown) =>
    app.inject({ method, url, payload: payload as any, headers: { authorization: `Bearer ${token}` } });

  const lotBody = (over: Record<string, unknown> = {}) => ({
    productVariantId: variantId,
    batchNumber: `tx-test-${randomUUID().slice(0, 8)}`,
    quantity: 5,
    unitCost: 10,
    expirationDate: "2027-06-30T00:00:00.000Z",
    ...over,
  });

  test("POST /inventory/dispatch acima do disponível → 422 INSUFFICIENT_STOCK", async () => {
    const lot = await call("POST", "/inventory/lots", lotBody({ quantity: 2 }));
    assert.equal(lot.statusCode, 200, lot.body);
    const res = await call("POST", "/inventory/dispatch", {
      productVariantId: variantId,
      quantity: 5,
      origin: "MANUAL",
    });
    assert.equal(res.statusCode, 422, res.body);
    assert.equal(res.json().code, "INSUFFICIENT_STOCK");
  });

  test("POST /inventory/boxes/:id/items acima do limite → 422 BOX_LIMIT_EXCEEDED com a mensagem exata", async () => {
    const lot = (await call("POST", "/inventory/lots", lotBody({ quantity: 3 }))).json().data;
    const box = await prisma.inventoryBox.create({ data: { code: `tx-test-${randomUUID()}` } });
    boxIds.push(box.id);
    const res = await call("POST", `/inventory/boxes/${box.id}/items`, {
      inventoryLotId: lot.id,
      quantity: 4,
    });
    assert.equal(res.statusCode, 422, res.body);
    assert.equal(res.json().code, "BOX_LIMIT_EXCEEDED");
    assert.equal(res.json().message, "Quantidade excede o saldo do lote disponível para caixas (3).");
  });

  test("GET /inventory/:id inexistente → 404 INVENTORY_NOT_FOUND", async () => {
    const res = await call("GET", `/inventory/${randomUUID()}`);
    assert.equal(res.statusCode, 404, res.body);
    assert.equal(res.json().code, "INVENTORY_NOT_FOUND");
  });

  test("POST /inventory/ variante já com inventário → 409 INVENTORY_ALREADY_EXISTS", async () => {
    const first = await call("POST", "/inventory/", { productVariantId: variantId });
    assert.equal(first.statusCode, 200, first.body);
    const res = await call("POST", "/inventory/", { productVariantId: variantId });
    assert.equal(res.statusCode, 409, res.body);
    assert.equal(res.json().code, "INVENTORY_ALREADY_EXISTS");
  });

  test("POST /inventory/lots quantity 0 → 400 VALIDATION_ERROR field 'quantity'", async () => {
    const res = await call("POST", "/inventory/lots", lotBody({ quantity: 0 }));
    assert.equal(res.statusCode, 400, res.body);
    const body = res.json();
    assert.equal(body.code, "VALIDATION_ERROR");
    assert.ok(body.errors.some((e: { field: string }) => e.field === "quantity"));
  });

  test("GET /inventory/variants/:id sem inventário → 404 (VariantStock depende disso)", async () => {
    const res = await call("GET", `/inventory/variants/${variantId}`);
    assert.equal(res.statusCode, 404, res.body);
    assert.equal(res.json().code, "INVENTORY_NOT_FOUND");
  });
});
