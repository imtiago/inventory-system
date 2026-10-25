import "dotenv/config";
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "@shared/prisma";
import { app } from "../../../../../app";
import { createTestVariant, getTestUserId } from "../../../../../test/inventoryFixtures";
import { signTestToken } from "../../../../../test/authFixtures";

app.log.level = "silent";

describe("Preço de venda da variante", () => {
  let productId: string;
  let cleanupVariant: () => Promise<void>;
  let token: string;
  const createdVariantIds: string[] = [];

  before(async () => {
    let variantId: string;
    ({ variantId, cleanup: cleanupVariant } = await createTestVariant());
    const variant = await prisma.productVariant.findUniqueOrThrow({ where: { id: variantId } });
    productId = variant.productId;
    token = signTestToken(await getTestUserId());
  });

  after(async () => {
    try {
      await prisma.productVariant.deleteMany({ where: { id: { in: createdVariantIds } } });
    } finally {
      try {
        await cleanupVariant();
      } finally {
        await app.close();
        await prisma.$disconnect();
      }
    }
  });

  const call = (method: "GET" | "POST" | "PUT", url: string, payload?: unknown) =>
    app.inject({ method, url, payload: payload as any, headers: { authorization: `Bearer ${token}` } });

  test("POST /products/:id/variants com salePrice 19.9 → GET mostra salePrice 19.9", async () => {
    const res = await call("POST", `/products/${productId}/variants`, { name: "tx-test-price", salePrice: 19.9 });
    assert.equal(res.statusCode, 201);
    const id = res.json().data.id;
    createdVariantIds.push(id);
    assert.equal(res.json().data.salePrice, 19.9);
    const get = await call("GET", `/variants/${id}`);
    assert.equal(get.statusCode, 200);
    assert.equal(get.json().data.salePrice, 19.9);
  });

  test("sem salePrice → preço 0", async () => {
    const res = await call("POST", `/products/${productId}/variants`, { name: "tx-test-noprice" });
    assert.equal(res.statusCode, 201);
    createdVariantIds.push(res.json().data.id);
    assert.equal(res.json().data.salePrice, 0);
  });

  test("salePrice negativo → 400 VALIDATION_ERROR field salePrice", async () => {
    const res = await call("POST", `/products/${productId}/variants`, { name: "tx-test-neg", salePrice: -1 });
    assert.equal(res.statusCode, 400);
    const body = res.json();
    assert.equal(body.code, "VALIDATION_ERROR");
    assert.ok(body.errors.some((e: { field: string }) => e.field === "salePrice"));
  });

  test("salePrice com mais de 2 casas decimais → 400 VALIDATION_ERROR (criar)", async () => {
    const res = await call("POST", `/products/${productId}/variants`, { name: "tx-test-dec", salePrice: 19.999 });
    assert.equal(res.statusCode, 400);
    const body = res.json();
    assert.equal(body.code, "VALIDATION_ERROR");
    assert.ok(body.errors.some((e: { field: string }) => e.field === "salePrice"));
  });

  test("salePrice acima de 9.999.999.999,99 → 400 no campo (criar e editar); no teto → 201", async () => {
    const MAX_ERROR = "O preço de venda deve ser no máximo 9.999.999.999,99.";
    for (const salePrice of [10_000_000_000, 1e12, 1e300]) {
      const res = await call("POST", `/products/${productId}/variants`, { name: "tx-test-max", salePrice });
      assert.equal(res.statusCode, 400, `${salePrice}: ${res.body}`);
      assert.deepEqual(res.json().errors, [{ field: "salePrice", message: MAX_ERROR }]);
    }
    const atMax = await call("POST", `/products/${productId}/variants`, { name: "tx-test-atmax", salePrice: 9_999_999_999.99 });
    assert.equal(atMax.statusCode, 201, atMax.body);
    createdVariantIds.push(atMax.json().data.id);
    assert.equal(atMax.json().data.salePrice, 9_999_999_999.99);

    const put = await call("PUT", `/variants/${atMax.json().data.id}`, { salePrice: 10_000_000_000 });
    assert.equal(put.statusCode, 400, put.body);
    assert.deepEqual(put.json().errors, [{ field: "salePrice", message: MAX_ERROR }]);
  });

  test("PUT /variants/:id altera salePrice → GET mostra", async () => {
    const create = await call("POST", `/products/${productId}/variants`, { name: "tx-test-upd", salePrice: 5 });
    const id = create.json().data.id;
    createdVariantIds.push(id);
    const put = await call("PUT", `/variants/${id}`, { salePrice: 12.34 });
    assert.equal(put.statusCode, 200);
    assert.equal(put.json().data.salePrice, 12.34);
    const get = await call("GET", `/variants/${id}`);
    assert.equal(get.json().data.salePrice, 12.34);
    assert.equal(get.json().data.name, "tx-test-upd");
  });

  test("PUT /variants/:id com barcode de outra variante → 409", async () => {
    const barcode = `tx-test-${randomUUID()}`;
    const a = await call("POST", `/products/${productId}/variants`, { name: "tx-test-ba", barcode });
    createdVariantIds.push(a.json().data.id);
    const b = await call("POST", `/products/${productId}/variants`, { name: "tx-test-bb" });
    createdVariantIds.push(b.json().data.id);
    const put = await call("PUT", `/variants/${b.json().data.id}`, { barcode });
    assert.equal(put.statusCode, 409);
    assert.equal(put.json().code, "BARCODE_ALREADY_EXISTS");
    const same = await call("PUT", `/variants/${a.json().data.id}`, { barcode });
    assert.equal(same.statusCode, 200);
  });

  test("PUT /variants/:id inexistente → 404 VARIANT_NOT_FOUND", async () => {
    const res = await call("PUT", `/variants/${randomUUID()}`, { salePrice: 1 });
    assert.equal(res.statusCode, 404);
    assert.equal(res.json().code, "VARIANT_NOT_FOUND");
  });

  test("PUT /variants/:id inválido → 400 VALIDATION_ERROR", async () => {
    const id = randomUUID();
    const neg = await call("PUT", `/variants/${id}`, { salePrice: -1 });
    assert.equal(neg.statusCode, 400);
    assert.ok(neg.json().errors.some((e: { field: string }) => e.field === "salePrice"));
    const dec = await call("PUT", `/variants/${id}`, { salePrice: 19.999 });
    assert.equal(dec.statusCode, 400);
    const empty = await call("PUT", `/variants/${id}`, {});
    assert.equal(empty.statusCode, 400);
    assert.equal(empty.json().code, "VALIDATION_ERROR");
  });

  test("POST de duas variantes com barcode em branco → ambas 201 (sem barcode)", async () => {
    const a = await call("POST", `/products/${productId}/variants`, { name: "tx-test-blank-a", barcode: "" });
    assert.equal(a.statusCode, 201);
    createdVariantIds.push(a.json().data.id);
    const b = await call("POST", `/products/${productId}/variants`, { name: "tx-test-blank-b", barcode: "   " });
    assert.equal(b.statusCode, 201);
    createdVariantIds.push(b.json().data.id);
    const c = await call("POST", `/products/${productId}/variants`, { name: "tx-test-blank-c", barcode: null });
    assert.equal(c.statusCode, 201);
    createdVariantIds.push(c.json().data.id);
    assert.equal(a.json().data.barcode ?? null, null);
    assert.equal(b.json().data.barcode ?? null, null);
  });

  test("PUT com barcode em branco → 200 e barcode null", async () => {
    const barcode = `tx-test-${randomUUID()}`;
    const create = await call("POST", `/products/${productId}/variants`, { name: "tx-test-clear", barcode });
    const id = create.json().data.id;
    createdVariantIds.push(id);
    const put = await call("PUT", `/variants/${id}`, { barcode: "", salePrice: 7 });
    assert.equal(put.statusCode, 200);
    assert.equal(put.json().data.barcode ?? null, null);
    assert.equal(put.json().data.salePrice, 7);
    const get = await call("GET", `/variants/${id}`);
    assert.equal(get.json().data.barcode ?? null, null);
  });
});
