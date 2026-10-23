import "dotenv/config";
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "@shared/prisma";
import { app } from "../../../../../app";
import { createTestUser, TestUser } from "../../../../../test/authFixtures";
import { createCatalogTestData } from "./catalogTestData";

app.log.level = "silent";

describe("DELETE /variants/:id", () => {
  const data = createCatalogTestData();
  let admin: TestUser;
  let estoquista: TestUser;
  let brandId: string;
  let categoryId: string;

  const del = (id: string, token: string = admin.token) =>
    app.inject({ method: "DELETE", url: `/variants/${id}`, headers: { authorization: `Bearer ${token}` } });

  before(async () => {
    admin = await createTestUser({ role: "ADMIN" });
    estoquista = await createTestUser({ role: "ESTOQUISTA" });
    brandId = (await data.brand()).id;
    categoryId = (await data.category()).id;
  });

  after(async () => {
    try {
      await data.cleanup();
    } finally {
      await admin.cleanup();
      await estoquista.cleanup();
      await app.close();
      await prisma.$disconnect();
    }
  });

  test("sem uso e com outra variante → 204; registro de estoque zerado some junto", async () => {
    const { product, variant } = await data.product({ brandId, categoryId });
    const extra = await data.variant(product.id);
    await data.zeroInventory(extra.id);

    const forbidden = await del(extra.id, estoquista.token);
    assert.equal(forbidden.statusCode, 403);

    const res = await del(extra.id);
    assert.equal(res.statusCode, 204, res.body);
    assert.equal(await prisma.productVariant.count({ where: { id: extra.id } }), 0);
    assert.equal(await prisma.inventory.count({ where: { productVariantId: extra.id } }), 0);
    assert.equal(await prisma.productVariant.count({ where: { id: variant.id } }), 1);
  });

  test("em uso → 409 VARIANT_IN_USE; última variante → 409 LAST_VARIANT", async () => {
    const { product, variant } = await data.product({ brandId, categoryId });
    const inUse = await data.variant(product.id);
    await data.movement(inUse.id);

    const busy = await del(inUse.id);
    assert.equal(busy.statusCode, 409, busy.body);
    assert.equal(busy.json().code, "VARIANT_IN_USE");
    assert.equal(await prisma.productVariant.count({ where: { id: inUse.id } }), 1);

    const sold = await data.product({ brandId, categoryId });
    const soldVariant = await data.variant(sold.product.id);
    await data.sale(soldVariant.id);
    const soldRes = await del(soldVariant.id);
    assert.equal(soldRes.statusCode, 409);
    assert.equal(soldRes.json().code, "VARIANT_IN_USE");

    const single = await data.product({ brandId, categoryId });
    const last = await del(single.variant.id);
    assert.equal(last.statusCode, 409, last.body);
    assert.deepEqual(last.json(), {
      message: "O produto precisa ter ao menos uma variante.",
      code: "LAST_VARIANT",
    });
    assert.equal(await prisma.productVariant.count({ where: { id: single.variant.id } }), 1);
    assert.equal(await prisma.productVariant.count({ where: { id: variant.id } }), 1);
  });

  test("inexistente → 404 VARIANT_NOT_FOUND", async () => {
    const res = await del(randomUUID());
    assert.equal(res.statusCode, 404);
    assert.equal(res.json().code, "VARIANT_NOT_FOUND");
  });
});
