import "dotenv/config";
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { prisma } from "@shared/prisma";
import { app } from "../../../../../app";
import { createTestVariant, getTestUserId } from "../../../../../test/inventoryFixtures";
import { PrismaProductVariantRepository } from "../../prisma/repositories/PrismaProductVariantRepository";

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
    token = jwt.sign({ sub: await getTestUserId(), role: "admin" }, process.env.JWT_SECRET!);
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

  const call = (method: "GET" | "POST", url: string, payload?: unknown) =>
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

  test("update de variante (repositório) altera salePrice", async () => {
    const create = await call("POST", `/products/${productId}/variants`, { name: "tx-test-upd", salePrice: 5 });
    const id = create.json().data.id;
    createdVariantIds.push(id);
    const repo = new PrismaProductVariantRepository();
    const variant = await repo.findById(id);
    assert.ok(variant);
    variant.changeSalePrice(12.34);
    await repo.update(variant);
    const get = await call("GET", `/variants/${id}`);
    assert.equal(get.json().data.salePrice, 12.34);
  });
});
