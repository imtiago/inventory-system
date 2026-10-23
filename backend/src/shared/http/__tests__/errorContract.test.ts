import "dotenv/config";
import { after, afterEach, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import Fastify from "fastify";
import { prisma } from "@shared/prisma";
import { app } from "../../../app";
import { registerErrorHandling } from "../errorHandler";
import { keyShape } from "../../../test/keyShape";
import { createTestVariant, getTestUserId } from "../../../test/inventoryFixtures";
import { signTestToken } from "../../../test/authFixtures";

const FIXTURES_DIR = new URL("../../../../../frontend/src/test/fixtures/errors/", import.meta.url);

function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(new URL(`${name}.json`, FIXTURES_DIR), "utf8"));
}

app.log.level = "silent";

describe("Contrato de erro HTTP (fixtures compartilhadas com o frontend)", () => {
  let variantId: string;
  let cleanupVariant: () => Promise<void>;
  let token: string;

  beforeEach(async () => {
    ({ variantId, cleanup: cleanupVariant } = await createTestVariant());
    token = signTestToken(await getTestUserId());
  });

  afterEach(async () => {
    await cleanupVariant();
  });

  after(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  const call = (method: "GET" | "POST", url: string, payload?: unknown) =>
    app.inject({ method, url, payload: payload as any, headers: { authorization: `Bearer ${token}` } });

  const expectShape = (body: unknown, fixture: string) =>
    assert.deepEqual(keyShape(body), keyShape(loadFixture(fixture)), `chaves diferem de ${fixture}.json`);

  test("400 validação → validation.json", async () => {
    const res = await call("POST", "/products", {});
    assert.equal(res.statusCode, 400, res.body);
    assert.equal(res.json().code, "VALIDATION_ERROR");
    expectShape(res.json(), "validation");
  });

  test("404 não encontrado → notFound.json", async () => {
    const res = await call("GET", `/products/${randomUUID()}`);
    assert.equal(res.statusCode, 404, res.body);
    expectShape(res.json(), "notFound");
  });

  test("409 conflito → conflict.json", async () => {
    const barcode = `tx-test-${randomUUID().slice(0, 12)}`;
    const variant = await prisma.productVariant.update({ where: { id: variantId }, data: { barcode } });
    const res = await call("POST", `/products/${variant.productId}/variants`, { name: "tx-test-dup", barcode });
    assert.equal(res.statusCode, 409, res.body);
    assert.equal(res.json().code, "BARCODE_ALREADY_EXISTS");
    expectShape(res.json(), "conflict");
  });

  test("422 regra de negócio → businessRule.json", async () => {
    const lot = await call("POST", "/inventory/lots", {
      productVariantId: variantId,
      batchNumber: `tx-test-${randomUUID().slice(0, 8)}`,
      quantity: 2,
      unitCost: 10,
      expirationDate: "2027-06-30T00:00:00.000Z",
    });
    assert.equal(lot.statusCode, 200, lot.body);
    const res = await call("POST", "/inventory/dispatch", {
      productVariantId: variantId,
      quantity: 5,
      origin: "MANUAL",
    });
    assert.equal(res.statusCode, 422, res.body);
    expectShape(res.json(), "businessRule");
  });

  test("500 interno → internal.json", async () => {
    const local = Fastify();
    registerErrorHandling(local);
    local.get("/boom", async () => {
      throw new Error("x");
    });
    const res = await local.inject({ method: "GET", url: "/boom" });
    await local.close();
    assert.equal(res.statusCode, 500);
    assert.equal(res.json().code, "INTERNAL_ERROR");
    expectShape(res.json(), "internal");
  });
});
