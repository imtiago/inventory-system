import "dotenv/config";
import { after, afterEach, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "@shared/prisma";
import { app } from "../../../../../app";
import { createTestVariant, getTestUserId } from "../../../../../test/inventoryFixtures";
import { signTestToken } from "../../../../../test/authFixtures";
import { withIdempotencyKey } from "../../../../../test/idempotency";
import { GenerateInventoryProductLabelsUseCase } from "@inventory/application/useCases/commands/GenerateInventoryProductLabelsUseCase";
import { DomainError } from "@shared/domain/errors";

app.log.level = "silent";

describe("Entradas/saídas manuais restritas e etiquetas com limite", () => {
  let variantId: string;
  let cleanupVariant: () => Promise<void>;
  let token: string;
  const boxIds: string[] = [];

  beforeEach(async () => {
    ({ variantId, cleanup: cleanupVariant } = await createTestVariant());
    token = signTestToken(await getTestUserId());
  });

  afterEach(async () => {
    const ids = boxIds.splice(0);
    try {
      await cleanupVariant();
    } finally {
      await prisma.inventoryBox.deleteMany({ where: { id: { in: ids } } });
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
      headers: withIdempotencyKey(method, { authorization: `Bearer ${token}` }),
    });

  const receiveBody = (over: Record<string, unknown> = {}) => ({
    productVariantId: variantId,
    quantity: 5,
    unitCost: 2,
    origin: "MANUAL",
    ...over,
  });

  const fieldsOf = (res: { json(): { errors?: { field: string }[] } }) =>
    (res.json().errors ?? []).map((e) => e.field);

  test("POST /inventory/receive: origem SALE/PURCHASE/RETURN/IMPORT → 400 no campo origin", async () => {
    for (const origin of ["SALE", "PURCHASE", "RETURN", "IMPORT"]) {
      const res = await request("POST", "/inventory/receive", receiveBody({ origin }));
      assert.equal(res.statusCode, 400, `${origin}: ${res.body}`);
      assert.deepEqual(fieldsOf(res), ["origin"], origin);
    }
    assert.equal(await prisma.stockMovement.count({ where: { productVariantId: variantId } }), 0);
  });

  test("POST /inventory/receive: sourceType diferente de MANUAL → 400; referência não-uuid e notes > 500 → 400", async () => {
    for (const sourceType of ["PURCHASE", "RETURN", "IMPORT", "TRANSFER"]) {
      const res = await request("POST", "/inventory/receive", receiveBody({ sourceType }));
      assert.equal(res.statusCode, 400, `${sourceType}: ${res.body}`);
      assert.deepEqual(fieldsOf(res), ["sourceType"], sourceType);
    }
    const ref = await request("POST", "/inventory/receive", receiveBody({ originReferenceId: "venda-123" }));
    assert.equal(ref.statusCode, 400, ref.body);
    assert.deepEqual(fieldsOf(ref), ["originReferenceId"]);

    const notes = await request("POST", "/inventory/receive", receiveBody({ notes: "x".repeat(501) }));
    assert.equal(notes.statusCode, 400, notes.body);
    assert.deepEqual(fieldsOf(notes), ["notes"]);
  });

  test("POST /inventory/receive: MANUAL/INVENTORY/TRANSFER aceitos; lote sempre MANUAL", async () => {
    const referenceId = randomUUID();
    for (const [origin, extra] of [
      ["MANUAL", { sourceType: "MANUAL" }],
      ["INVENTORY", {}],
      ["TRANSFER", { originReferenceId: referenceId, notes: "x".repeat(500) }],
    ] as const) {
      const res = await request(
        "POST",
        "/inventory/receive",
        receiveBody({ origin, batchNumber: `tx-test-${randomUUID().slice(0, 8)}`, ...extra }),
      );
      assert.equal(res.statusCode, 200, `${origin}: ${res.body}`);
    }
    const lots = await prisma.inventoryLot.findMany({ where: { productVariantId: variantId } });
    assert.equal(lots.length, 3);
    assert.ok(lots.every((lot) => lot.sourceType === "MANUAL"));
    const movements = await prisma.stockMovement.findMany({
      where: { productVariantId: variantId },
      orderBy: { createdAt: "asc" },
    });
    assert.deepEqual(movements.map((m) => m.origin).sort(), ["INVENTORY", "MANUAL", "TRANSFER"]);
    assert.equal(movements.find((m) => m.origin === "TRANSFER")?.originId, referenceId);
  });

  test("POST /inventory/dispatch: SALE/RETURN/PURCHASE → 400; MANUAL/INVENTORY/TRANSFER aceitos", async () => {
    assert.equal((await request("POST", "/inventory/receive", receiveBody({ quantity: 10 }))).statusCode, 200);

    for (const origin of ["SALE", "RETURN", "PURCHASE", "IMPORT"]) {
      const res = await request("POST", "/inventory/dispatch", {
        productVariantId: variantId,
        quantity: 1,
        origin,
        originReferenceId: randomUUID(),
      });
      assert.equal(res.statusCode, 400, `${origin}: ${res.body}`);
      assert.deepEqual(fieldsOf(res), ["origin"], origin);
    }
    for (const origin of ["MANUAL", "INVENTORY", "TRANSFER"]) {
      const res = await request("POST", "/inventory/dispatch", { productVariantId: variantId, quantity: 1, origin });
      assert.equal(res.statusCode, 200, `${origin}: ${res.body}`);
    }
    const outs = await prisma.stockMovement.count({ where: { productVariantId: variantId, type: "OUT" } });
    assert.equal(outs, 3);
  });

  describe("etiquetas de produto", () => {
    const createBox = async () => {
      const box = await prisma.inventoryBox.create({ data: { code: `tx-test-${randomUUID()}` } });
      boxIds.push(box.id);
      return box;
    };
    const labels = (code: string, body: unknown) =>
      request("POST", `/inventory/boxes/code/${encodeURIComponent(code)}/product-labels`, body);

    test("quantity 501 → 400; 0 → 400; productCode > 100 → 400; 500 → PDF", async () => {
      const box = await createBox();

      const tooMany = await labels(box.code, { productCode: "P-1", quantity: 501 });
      assert.equal(tooMany.statusCode, 400, tooMany.body);
      assert.deepEqual(fieldsOf(tooMany), ["quantity"]);

      const zero = await labels(box.code, { productCode: "P-1", quantity: 0 });
      assert.equal(zero.statusCode, 400, zero.body);

      const longCode = await labels(box.code, { productCode: "x".repeat(101), quantity: 1 });
      assert.equal(longCode.statusCode, 400, longCode.body);
      assert.deepEqual(fieldsOf(longCode), ["productCode"]);

      const ok = await labels(box.code, { productCode: "x".repeat(100), quantity: 500 });
      assert.equal(ok.statusCode, 200);
      assert.match(String(ok.headers["content-type"]), /application\/pdf/);
      assert.equal(ok.rawPayload.subarray(0, 5).toString(), "%PDF-");
    });

    test("use case também valida o teto (sem gerar PDF)", async () => {
      let generated = false;
      const useCase = new GenerateInventoryProductLabelsUseCase(
        { getByCode: async () => ({ code: "BOX-1" }) } as never,
        { generateProductLabels: async () => ((generated = true), Buffer.alloc(0)) } as never,
      );
      for (const [quantity, productCode] of [
        [501, "P-1"],
        [1e10, "P-1"],
        [1.5, "P-1"],
        [1, "x".repeat(101)],
      ] as const) {
        await assert.rejects(
          useCase.execute({ boxCode: "BOX-1", productCode, quantity }),
          (e: unknown) => e instanceof DomainError,
          `${quantity}/${productCode.length}`,
        );
      }
      assert.equal(generated, false);
    });
  });
});
