import "dotenv/config";
import { after, afterEach, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "@shared/prisma";
import { app } from "../../../app";
import { createTestVariant, getTestUserId } from "../../../test/inventoryFixtures";
import { signTestToken } from "../../../test/authFixtures";
import { withIdempotencyKey } from "../../../test/idempotency";

app.log.level = "silent";

/**
 * Tetos de quantidade/valor nas demais rotas (varredura da onda 1): acima deles a
 * entrada viraria overflow de Int/DECIMAL(12,2) no banco (500). Esperado: 400 no campo.
 */
describe("Tetos de quantidade e valor (400 no campo, nunca 500)", () => {
  let variantId: string;
  let cleanupVariant: () => Promise<void>;
  let token: string;
  let customerId: string;

  beforeEach(async () => {
    ({ variantId, cleanup: cleanupVariant } = await createTestVariant());
    token = signTestToken(await getTestUserId());
    const tag = `tx-test-${randomUUID()}`;
    customerId = (await prisma.customer.create({ data: { name: tag, code: tag } })).id;
  });

  afterEach(async () => {
    try {
      await prisma.sale.deleteMany({ where: { customerId } });
    } finally {
      try {
        await cleanupVariant();
      } finally {
        await prisma.customer.deleteMany({ where: { id: customerId } });
      }
    }
  });

  after(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  const post = (url: string, payload: unknown) =>
    app.inject({
      method: "POST",
      url,
      payload: payload as any,
      headers: withIdempotencyKey("POST", { authorization: `Bearer ${token}` }),
    });

  const expect400 = async (url: string, payload: unknown, field: string) => {
    const res = await post(url, payload);
    assert.equal(res.statusCode, 400, `${url}: ${res.body}`);
    const fields = (res.json().errors ?? []).map((e: { field: string }) => e.field);
    assert.ok(fields.includes(field), `${url}: esperado erro em ${field}, veio ${fields.join(",")}`);
  };

  const TOO_MANY = 1_000_001;

  test("estoque: quantidade > 1.000.000 e custo unitário > 1.000.000 → 400", async () => {
    const lot = {
      productVariantId: variantId,
      batchNumber: `tx-test-${randomUUID().slice(0, 8)}`,
      quantity: 1,
      unitCost: 1,
      expirationDate: "2030-01-01T00:00:00.000Z",
    };
    await expect400("/inventory/lots", { ...lot, quantity: TOO_MANY }, "quantity");
    await expect400("/inventory/lots", { ...lot, unitCost: 1_000_000.01 }, "unitCost");
    await expect400(
      "/inventory/receive",
      { productVariantId: variantId, quantity: TOO_MANY, unitCost: 1, origin: "MANUAL" },
      "quantity",
    );
    await expect400(
      "/inventory/receive",
      { productVariantId: variantId, quantity: 1, unitCost: 1e12, origin: "MANUAL" },
      "unitCost",
    );
    await expect400(
      "/inventory/dispatch",
      { productVariantId: variantId, quantity: TOO_MANY, origin: "MANUAL" },
      "quantity",
    );
    await expect400("/inventory/adjust", { productVariantId: variantId, countedQuantity: TOO_MANY }, "countedQuantity");
    await expect400(
      "/inventory/reserve",
      { productVariantId: variantId, quantity: TOO_MANY, originId: randomUUID() },
      "quantity",
    );
    await expect400("/inventory/release", { inventoryId: randomUUID(), quantity: TOO_MANY }, "quantity");
    await expect400(
      "/inventory/initial-count",
      { barcode: "x", boxCode: "y", quantity: TOO_MANY },
      "quantity",
    );
    await expect400(
      "/inventory/initial-count",
      { barcode: "x", boxCode: "y", quantity: 1, unitCost: 1e12 },
      "unitCost",
    );
    await expect400(
      `/inventory/boxes/${randomUUID()}/items`,
      { inventoryLotId: randomUUID(), quantity: TOO_MANY },
      "quantity",
    );
    assert.equal(await prisma.stockMovement.count({ where: { productVariantId: variantId } }), 0);
  });

  test("venda: quantidade > 1.000.000 → 400; total acima de 9.999.999.999,99 → 400 em items sem baixar estoque", async () => {
    const sale = (quantity: number) => ({
      customerId,
      items: [{ productVariantId: variantId, quantity }],
      paymentTerms: { installments: 1 },
    });
    await expect400("/sales", sale(TOO_MANY), "items.0.quantity");

    await prisma.productVariant.update({ where: { id: variantId }, data: { salePrice: 9_999_999_999.99 } });
    const res = await post("/sales", sale(2));
    assert.equal(res.statusCode, 400, res.body);
    assert.deepEqual(res.json().errors, [{ field: "items", message: "O total da venda excede o máximo permitido." }]);
    assert.equal(await prisma.sale.count({ where: { customerId } }), 0);
    assert.equal(await prisma.stockMovement.count({ where: { productVariantId: variantId } }), 0);
  });

  test("pagamento: valor acima de 9.999.999.999,99 → 400 no campo amount", async () => {
    for (const prefix of ["/receivables", "/payables"]) {
      await expect400(
        `${prefix}/${randomUUID()}/parcels/${randomUUID()}/payments`,
        { amount: 10_000_000_000, method: "PIX" },
        "amount",
      );
    }
  });
});
