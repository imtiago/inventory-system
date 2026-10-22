import "dotenv/config";
import { after, afterEach, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import jwt from "jsonwebtoken";
import { prisma } from "@shared/prisma";
import { app } from "../../../../../app";
import {
  createTestVariant,
  getTestUserId,
} from "../../../../../test/inventoryFixtures";

const FIXTURES_DIR = new URL(
  "../../../../../../../frontend/src/test/fixtures/inventory/",
  import.meta.url,
);

function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(new URL(`${name}.json`, FIXTURES_DIR), "utf8"));
}

// Shape of keys only: objects → sorted keys (recursively), arrays → shape of the first item.
function keyShape(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.length > 0 ? [keyShape(value[0])] : [];
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      out[key] = keyShape((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return null;
}

// Sem logs de requisição na saída dos testes.
app.log.level = "silent";

describe("HTTP de estoque", () => {
  let variantId: string;
  let cleanupVariant: () => Promise<void>;
  let userId: string;
  let token: string;
  const boxIds: string[] = [];

  beforeEach(async () => {
    ({ variantId, cleanup: cleanupVariant } = await createTestVariant());
    userId = await getTestUserId();
    token = jwt.sign(
      { sub: userId, role: "admin" },
      process.env.JWT_SECRET || "secret",
    );
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

  const request = (method: "GET" | "POST", url: string, payload?: unknown) =>
    app.inject({
      method,
      url,
      payload: payload as any,
      headers: { authorization: `Bearer ${token}` },
    });

  const lotBody = (over: Record<string, unknown> = {}) => ({
    productVariantId: variantId,
    batchNumber: `tx-test-${randomUUID().slice(0, 8)}`,
    quantity: 5,
    unitCost: 10,
    expirationDate: "2027-06-30T00:00:00.000Z",
    ...over,
  });

  const createBox = async () => {
    const box = await prisma.inventoryBox.create({
      data: { code: `tx-test-${randomUUID()}` },
    });
    boxIds.push(box.id);
    return box;
  };

  test("GET /inventory/:id retorna 200 com averageCost e productVariant", async () => {
    const lotRes = await request("POST", "/inventory/lots", lotBody({ unitCost: 12.5 }));
    assert.equal(lotRes.statusCode, 200, lotRes.body);
    const inventory = await prisma.inventory.findUniqueOrThrow({
      where: { productVariantId: variantId },
    });

    const res = await request("GET", `/inventory/${inventory.id}`);

    assert.equal(res.statusCode, 200, res.body);
    const dto = res.json().data;
    assert.equal(dto.id, inventory.id);
    assert.equal(dto.quantity, 5);
    assert.equal(dto.availableQuantity, 5);
    assert.equal(dto.averageCost, 12.5);
    assert.equal(dto.productVariant.id, variantId);
  });

  test("POST /inventory/lots recebe estoque e retorna lote com remainingQuantity", async () => {
    const res = await request("POST", "/inventory/lots", lotBody({ quantity: 7 }));

    assert.equal(res.statusCode, 200, res.body);
    const lot = res.json().data;
    assert.equal(lot.productVariantId, variantId);
    assert.equal(lot.initialQuantity, 7);
    assert.equal(lot.remainingQuantity, 7);
    assert.equal(lot.allocatedQuantity, 0);
    assert.equal(lot.unitCost, 10);
    assert.equal(lot.sourceType, "MANUAL");

    const inventory = await prisma.inventory.findUniqueOrThrow({
      where: { productVariantId: variantId },
    });
    assert.equal(inventory.quantity, 7);
    assert.equal(lot.inventoryId, inventory.id);
  });

  test("POST /inventory/lots grava manufacturingDate", async () => {
    const res = await request(
      "POST",
      "/inventory/lots",
      lotBody({ manufacturingDate: "2026-01-15T00:00:00.000Z" }),
    );
    assert.equal(res.statusCode, 200, res.body);
    const lot = res.json().data;

    const stored = await prisma.inventoryLot.findUniqueOrThrow({ where: { id: lot.id } });
    assert.equal(stored.manufacturingDate?.toISOString(), "2026-01-15T00:00:00.000Z");
    assert.equal(stored.expirationDate?.toISOString(), "2027-06-30T00:00:00.000Z");
    assert.equal(lot.manufacturingDate, "2026-01-15T00:00:00.000Z");
  });

  test("movimentação do POST /lots tem userId do token", async () => {
    const res = await request("POST", "/inventory/lots", lotBody());
    assert.equal(res.statusCode, 200, res.body);
    const lot = res.json().data;

    const movements = await prisma.stockMovement.findMany({
      where: { inventoryLotId: lot.id },
    });
    assert.equal(movements.length, 1);
    assert.equal(movements[0].userId, userId);
    assert.equal(movements[0].type, "IN");
    assert.equal(movements[0].origin, "INVENTORY");
  });

  test("POST /inventory/ cria inventário com saldo 0 e recusa duplicado", async () => {
    const res = await request("POST", "/inventory/", { productVariantId: variantId });
    assert.equal(res.statusCode, 200, res.body);
    const dto = res.json().data;
    assert.equal(dto.productVariantId, variantId);
    assert.equal(dto.quantity, 0);
    assert.equal(dto.averageCost, 0);

    const dup = await request("POST", "/inventory/", { productVariantId: variantId });
    assert.equal(dup.statusCode, 400);
    assert.ok(dup.json().message);
  });

  test("POST /inventory/boxes/:id/items acima do limite → 400 com mensagem exata", async () => {
    const lotRes = await request("POST", "/inventory/lots", lotBody({ quantity: 3 }));
    const lot = lotRes.json().data;
    const box = await createBox();

    const res = await request("POST", `/inventory/boxes/${box.id}/items`, {
      inventoryLotId: lot.id,
      quantity: 4,
    });

    assert.equal(res.statusCode, 400);
    assert.equal(
      res.json().message,
      "Quantidade excede o saldo do lote disponível para caixas (3).",
    );

    const ok = await request("POST", `/inventory/boxes/${box.id}/items`, {
      inventoryLotId: lot.id,
      quantity: 3,
    });
    assert.equal(ok.statusCode, 200, ok.body);
  });

  test("GET /inventory/boxes?search filtra por código", async () => {
    const a = await createBox();
    await createBox();

    const res = await request(
      "GET",
      `/inventory/boxes?search=${encodeURIComponent(a.code.slice(8))}`,
    );

    assert.equal(res.statusCode, 200, res.body);
    const body = res.json();
    assert.deepEqual(
      body.data.map((b: { code: string }) => b.code),
      [a.code],
    );
    assert.equal(body.pagination.total, 1);
  });

  test("erro Zod retorna message legível", async () => {
    const res = await request("POST", "/inventory/lots", lotBody({ quantity: -1 }));

    assert.equal(res.statusCode, 400);
    assert.match(res.json().message, /quantity: /);
  });

  test("dispatch/reserve/release/adjust/initial-count respondem movimentações com userId do token", async () => {
    const barcode = `tx-test-${randomUUID().slice(0, 12)}`;
    await prisma.productVariant.update({ where: { id: variantId }, data: { barcode } });
    const box = await createBox();

    const scan = await request("POST", "/inventory/initial-count", {
      barcode,
      boxCode: box.code,
      quantity: 6,
      unitCost: 4,
    });
    assert.equal(scan.statusCode, 200, scan.body);
    assert.deepEqual(Object.keys(scan.json().data).sort(), [
      "boxCode",
      "boxId",
      "inventoryLotId",
      "quantity",
    ]);
    const inventory = await prisma.inventory.findUniqueOrThrow({
      where: { productVariantId: variantId },
    });

    const reserve = await request("POST", "/inventory/reserve", {
      productVariantId: variantId,
      quantity: 2,
      originId: randomUUID(),
    });
    assert.equal(reserve.statusCode, 200, reserve.body);
    assert.equal(reserve.json().data.type, "RESERVE");
    assert.equal(reserve.json().data.userId, userId);

    const release = await request("POST", "/inventory/release", {
      inventoryId: inventory.id,
      quantity: 2,
    });
    assert.equal(release.statusCode, 200, release.body);
    assert.equal(release.json().data.type, "RELEASE");

    const dispatch = await request("POST", "/inventory/dispatch", {
      productVariantId: variantId,
      quantity: 1,
      origin: "MANUAL",
    });
    assert.equal(dispatch.statusCode, 200, dispatch.body);
    assert.equal(dispatch.json().data.length, 1);
    assert.equal(dispatch.json().data[0].type, "OUT");
    assert.equal(dispatch.json().data[0].currentQuantity, 5);
    assert.equal(dispatch.json().data[0].userId, userId);

    const adjust = await request("POST", "/inventory/adjust", {
      productVariantId: variantId,
      countedQuantity: 5,
    });
    assert.equal(adjust.statusCode, 200, adjust.body);
    assert.equal(adjust.json().data, null);

    const adjustDown = await request("POST", "/inventory/adjust", {
      productVariantId: variantId,
      countedQuantity: 3,
    });
    assert.equal(adjustDown.statusCode, 200, adjustDown.body);
    assert.equal(adjustDown.json().data.type, "ADJUSTMENT");
    assert.equal(adjustDown.json().data.userId, userId);
  });

  test("contrato: chaves de cada rota == fixtures do frontend", async () => {
    const checks: Array<[string, string, unknown]> = [];
    const check = (fixture: string, route: string, body: unknown) =>
      checks.push([fixture, route, body]);

    const lotRes = await request("POST", "/inventory/lots", lotBody());
    assert.equal(lotRes.statusCode, 200, lotRes.body);
    check("inventoryLot", "POST /inventory/lots", lotRes.json());

    const inventory = await prisma.inventory.findUniqueOrThrow({
      where: { productVariantId: variantId },
    });
    check("inventory", "GET /inventory/:id", (await request("GET", `/inventory/${inventory.id}`)).json());
    check(
      "inventory",
      "GET /inventory/variants/:variantId",
      (await request("GET", `/inventory/variants/${variantId}`)).json(),
    );
    check(
      "inventory",
      "POST /inventory/receive",
      (
        await request("POST", "/inventory/receive", {
          productVariantId: variantId,
          quantity: 1,
          unitCost: 10,
          origin: "PURCHASE",
          sourceType: "PURCHASE",
        })
      ).json(),
    );
    check("inventoryList", "GET /inventory", (await request("GET", "/inventory?page=1&limit=1")).json());
    check(
      "inventoryLotList",
      "GET /inventory/variants/:id/lots",
      (await request("GET", `/inventory/variants/${variantId}/lots?page=1&limit=10`)).json(),
    );

    const boxRes = await request("POST", "/inventory/boxes", {});
    assert.equal(boxRes.statusCode, 200, boxRes.body);
    const box = boxRes.json().data;
    boxIds.push(box.id);
    check("inventoryBox", "POST /inventory/boxes", boxRes.json());
    check(
      "inventoryBox",
      "GET /inventory/boxes/code/:code",
      (await request("GET", `/inventory/boxes/code/${encodeURIComponent(box.code)}`)).json(),
    );
    check(
      "inventoryBoxList",
      "GET /inventory/boxes",
      (await request("GET", `/inventory/boxes?search=${encodeURIComponent(box.code)}`)).json(),
    );

    for (const [fixture, route, body] of checks) {
      assert.deepEqual(
        keyShape(body),
        keyShape(loadFixture(fixture)),
        `${route} keys differ from fixture ${fixture}.json`,
      );
    }
  });
});
