import "dotenv/config";
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import { prisma } from "@shared/prisma";
import { app } from "../../../../../app";

import { createTestVariant, getTestUserId } from "../../../../../test/inventoryFixtures";

app.log.level = "silent";

describe("Erros HTTP do catálogo", () => {
  let variantId: string;
  let productId: string;
  let cleanupVariant: () => Promise<void>;
  let token: string;
  const createdVariantIds: string[] = [];

  before(async () => {
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

  test("GET /products/:id inexistente → 404 PRODUCT_NOT_FOUND", async () => {
    const res = await call("GET", `/products/${randomUUID()}`);
    assert.equal(res.statusCode, 404);
    assert.equal(res.json().code, "PRODUCT_NOT_FOUND");
  });

  test("POST /products/:id/variants com barcode duplicado → 409 BARCODE_ALREADY_EXISTS", async () => {
    const barcode = `tx-test-${randomUUID()}`;
    const first = await call("POST", `/products/${productId}/variants`, { name: "tx-test-a", barcode });
    assert.equal(first.statusCode, 201);
    createdVariantIds.push(first.json().data.id);
    const second = await call("POST", `/products/${productId}/variants`, { name: "tx-test-b", barcode });
    assert.equal(second.statusCode, 409);
    assert.equal(second.json().code, "BARCODE_ALREADY_EXISTS");
  });

  test("POST /products corpo inválido → 400 VALIDATION_ERROR com errors[].field 'name'", async () => {
    const res = await call("POST", "/products", { name: "a" });
    assert.equal(res.statusCode, 400);
    const body = res.json();
    assert.equal(body.code, "VALIDATION_ERROR");
    assert.ok(body.errors.some((e: { field: string }) => e.field === "name"));
  });

  test("GET /products/:id com id não-uuid → 400 VALIDATION_ERROR", async () => {
    const res = await call("GET", "/products/nao-e-uuid");
    assert.equal(res.statusCode, 400);
    assert.equal(res.json().code, "VALIDATION_ERROR");
  });

  test("GET /variants/barcode/:id em branco → 400 VALIDATION_ERROR", async () => {
    const res = await call("GET", "/variants/barcode/%20%20");
    assert.equal(res.statusCode, 400);
    assert.equal(res.json().code, "VALIDATION_ERROR");
  });

  test("GET /variants/barcode/:id desconhecido → 404 VARIANT_NOT_FOUND", async () => {
    const res = await call("GET", `/variants/barcode/tx-test-${randomUUID()}`);
    assert.equal(res.statusCode, 404);
    assert.equal(res.json().code, "VARIANT_NOT_FOUND");
  });
});
