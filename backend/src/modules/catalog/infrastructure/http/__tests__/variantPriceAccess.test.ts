import "dotenv/config";
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@shared/prisma";
import { app } from "../../../../../app";
import { createTestVariant } from "../../../../../test/inventoryFixtures";
import { createTestUser, TestUser } from "../../../../../test/authFixtures";

app.log.level = "silent";

const FORBIDDEN_MESSAGE = "Somente o administrador pode alterar o preço de venda.";

describe("Preço de venda: somente o administrador altera", () => {
  let productId: string;
  let cleanupVariant: () => Promise<void>;
  const users = {} as Record<"ADMIN" | "VENDEDOR" | "ESTOQUISTA", TestUser>;
  const createdVariantIds: string[] = [];

  before(async () => {
    let variantId: string;
    ({ variantId, cleanup: cleanupVariant } = await createTestVariant());
    productId = (await prisma.productVariant.findUniqueOrThrow({ where: { id: variantId } })).productId;
    for (const role of ["ADMIN", "VENDEDOR", "ESTOQUISTA"] as const) users[role] = await createTestUser({ role });
  });

  after(async () => {
    try {
      await prisma.productVariant.deleteMany({ where: { id: { in: createdVariantIds } } });
    } finally {
      try {
        await cleanupVariant();
        for (const u of Object.values(users)) await u?.cleanup();
      } finally {
        await app.close();
        await prisma.$disconnect();
      }
    }
  });

  const call = (role: keyof typeof users, method: "GET" | "POST" | "PUT", url: string, payload?: unknown) =>
    app.inject({ method, url, payload: payload as any, headers: { authorization: `Bearer ${users[role].token}` } });

  async function makeVariant(price: number) {
    const res = await call("ADMIN", "POST", `/products/${productId}/variants`, { name: "tx-test-acc", salePrice: price });
    assert.equal(res.statusCode, 201, res.body);
    createdVariantIds.push(res.json().data.id);
    return res.json().data.id as string;
  }

  for (const role of ["VENDEDOR", "ESTOQUISTA"] as const) {
    test(`${role}: PUT com preço diferente → 403 FORBIDDEN e o preço não muda`, async () => {
      const id = await makeVariant(10);
      const res = await call(role, "PUT", `/variants/${id}`, { name: "novo nome", salePrice: 11 });
      assert.equal(res.statusCode, 403, res.body);
      assert.deepEqual(res.json(), { message: FORBIDDEN_MESSAGE, code: "FORBIDDEN" });
      const get = await call("ADMIN", "GET", `/variants/${id}`);
      assert.equal(get.json().data.salePrice, 10);
      assert.equal(get.json().data.name, "tx-test-acc");
    });

    test(`${role}: PUT com o mesmo preço (substituição completa) e nome novo → 200`, async () => {
      const id = await makeVariant(19.9);
      const res = await call(role, "PUT", `/variants/${id}`, { name: "renomeada", salePrice: 19.9 });
      assert.equal(res.statusCode, 200, res.body);
      assert.equal(res.json().data.name, "renomeada");
      assert.equal(res.json().data.salePrice, 19.9);
    });

    test(`${role}: PUT só com nome → 200`, async () => {
      const id = await makeVariant(3);
      const res = await call(role, "PUT", `/variants/${id}`, { name: "so-nome" });
      assert.equal(res.statusCode, 200, res.body);
    });

    test(`${role}: POST sem preço → 400 no campo salePrice; com preço → 201`, async () => {
      const bad = await call(role, "POST", `/products/${productId}/variants`, { name: "tx-test-sempreco" });
      assert.equal(bad.statusCode, 400, bad.body);
      assert.equal(bad.json().code, "VALIDATION_ERROR");
      assert.ok(bad.json().errors.some((e: { field: string }) => e.field === "salePrice"));
      const ok = await call(role, "POST", `/products/${productId}/variants`, { name: "tx-test-compreco", salePrice: 4.5 });
      assert.equal(ok.statusCode, 201, ok.body);
      createdVariantIds.push(ok.json().data.id);
      assert.equal(ok.json().data.salePrice, 4.5);
    });
  }

  test("ADMIN altera o preço → 200", async () => {
    const id = await makeVariant(10);
    const res = await call("ADMIN", "PUT", `/variants/${id}`, { salePrice: 12 });
    assert.equal(res.statusCode, 200, res.body);
    assert.equal(res.json().data.salePrice, 12);
  });
});
