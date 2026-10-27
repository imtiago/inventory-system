import "dotenv/config";
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "@shared/prisma";
import { app } from "../../../../../app";
import { createTestUser, TestUser } from "../../../../../test/authFixtures";
import { createTestVariant } from "../../../../../test/inventoryFixtures";
import { withIdempotencyKey } from "../../../../../test/idempotency";
import { parseCsv } from "../../../../../test/csvParse";

app.log.level = "silent";

const COST_KEYS = ["averageCost", "unitCost", "acquisitionExtraCost", "totalStockValue", "stockValue"];
const PRICING_KEYS = ["targetMarginBps", "targetMarginPercent", "supplierSuggestedPrice", "profit", "margin"];

/** Procura qualquer chave proibida, em qualquer profundidade. */
function findKeys(value: unknown, keys: string[], path = "$"): string[] {
  if (Array.isArray(value)) return value.flatMap((v, i) => findKeys(v, keys, `${path}[${i}]`));
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([k, v]) => [
      ...(keys.includes(k) ? [`${path}.${k}`] : []),
      ...findKeys(v, keys, `${path}.${k}`),
    ]);
  }
  return [];
}

describe("Custo do estoque por papel", () => {
  let admin: TestUser;
  let vendedor: TestUser;
  let estoquista: TestUser;
  let variantId: string;
  let cleanupVariant: () => Promise<void>;
  let inventoryId: string;
  let boxCode: string;
  let boxId: string;

  const get = (url: string, user: TestUser) =>
    app.inject({ method: "GET", url, headers: { authorization: `Bearer ${user.token}` } });

  before(async () => {
    admin = await createTestUser({ role: "ADMIN" });
    vendedor = await createTestUser({ role: "VENDEDOR" });
    estoquista = await createTestUser({ role: "ESTOQUISTA" });
    ({ variantId, cleanup: cleanupVariant } = await createTestVariant());
    const res = await app.inject({
      method: "POST",
      url: "/inventory/lots",
      headers: withIdempotencyKey("POST", { authorization: `Bearer ${admin.token}` }),
      payload: {
        productVariantId: variantId,
        batchNumber: `tx-test-${randomUUID().slice(0, 8)}`,
        quantity: 5,
        unitCost: 12.5,
        expirationDate: "2027-06-30T00:00:00.000Z",
      },
    });
    assert.equal(res.statusCode, 200, res.body);
    inventoryId = res.json().data.inventoryId;
    boxCode = `tx-test-${randomUUID()}`;
    boxId = (await prisma.inventoryBox.create({ data: { code: boxCode } })).id;
    await prisma.inventoryBoxStock.create({
      data: { boxId, inventoryLotId: res.json().data.id, quantity: 2 },
    });
  });

  after(async () => {
    try {
      await prisma.inventoryBoxStock.deleteMany({ where: { boxId } });
      await prisma.inventoryBox.deleteMany({ where: { id: boxId } });
      await cleanupVariant();
    } finally {
      await admin.cleanup();
      await vendedor.cleanup();
      await estoquista.cleanup();
      await app.close();
      await prisma.$disconnect();
    }
  });

  const urls = () => [
    `/inventory?productVariantIds=${variantId}`,
    `/inventory/${inventoryId}`,
    `/inventory/variants/${variantId}`,
    `/inventory/variants/${variantId}/lots?page=1&limit=10`,
    `/inventory/movements?productVariantId=${variantId}`,
    `/inventory/dashboard`,
    `/inventory/boxes/code/${encodeURIComponent(boxCode)}`,
  ];

  test("ADMIN e ESTOQUISTA recebem o custo; ninguém além do ADMIN recebe margem/lucro", async () => {
    for (const user of [admin, estoquista]) {
      const found = new Set<string>();
      for (const url of urls()) {
        const res = await get(url, user);
        assert.equal(res.statusCode, 200, `${url}: ${res.body}`);
        for (const f of findKeys(res.json(), COST_KEYS)) found.add(f.split(".").pop()!);
        if (user === estoquista) assert.deepEqual(findKeys(res.json(), PRICING_KEYS), [], url);
      }
      for (const k of ["averageCost", "unitCost", "acquisitionExtraCost", "totalStockValue"]) {
        assert.ok(found.has(k), `${k} presente para ${user.role}`);
      }
    }
  });

  test("VENDEDOR não recebe nenhum campo de custo em nenhuma rota de estoque (200, sem a chave)", async () => {
    for (const url of urls()) {
      const res = await get(url, vendedor);
      assert.equal(res.statusCode, 200, `${url}: ${res.body}`);
      assert.deepEqual(findKeys(res.json(), COST_KEYS.concat(PRICING_KEYS)), [], url);
    }
    const list = await get(`/inventory?productVariantIds=${variantId}`, vendedor);
    assert.equal(list.json().data[0].quantity, 5);
  });

  test("stock.csv: ADMIN/ESTOQUISTA com custo; VENDEDOR sem as colunas de custo", async () => {
    const full = ["Produto", "Variante", "Código", "Código de barras", "Quantidade", "Reservado", "Disponível", "Custo médio", "Valor em estoque"];
    for (const user of [admin, estoquista]) {
      const res = await get("/reports/stock.csv", user);
      assert.equal(res.statusCode, 200);
      assert.deepEqual(parseCsv(res.body)[0], full);
    }
    const res = await get("/reports/stock.csv", vendedor);
    assert.equal(res.statusCode, 200);
    const rows = parseCsv(res.body);
    assert.deepEqual(rows[0], full.slice(0, 7));
    assert.ok(rows.every((r) => r.length === 7));
    assert.ok(!res.body.includes("12,50"));
  });
});
