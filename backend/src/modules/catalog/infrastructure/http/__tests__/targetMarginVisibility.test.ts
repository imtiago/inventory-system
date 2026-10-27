import "dotenv/config";
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@shared/prisma";
import { app } from "../../../../../app";
import { createTestUser, TestUser } from "../../../../../test/authFixtures";
import { createCatalogTestData } from "./catalogTestData";

app.log.level = "silent";

/** Margem-alvo salva só aparece para quem tem `pricing.manage` (ADMIN). */
describe("Margem-alvo nos DTOs do catálogo", () => {
  const data = createCatalogTestData();
  let admin: TestUser;
  let vendedor: TestUser;
  let categoryId: string;
  let productId: string;
  let variantId: string;
  let unsetVariantId: string;

  const call = (url: string, user: TestUser) =>
    app.inject({ method: "GET", url, headers: { authorization: `Bearer ${user.token}` } });

  before(async () => {
    admin = await createTestUser({ role: "ADMIN" });
    vendedor = await createTestUser({ role: "VENDEDOR" });
    const brand = await data.brand();
    const category = await data.category();
    categoryId = category.id;
    const { product, variant } = await data.product({ brandId: brand.id, categoryId });
    productId = product.id;
    variantId = variant.id;
    unsetVariantId = (await data.variant(productId)).id;
    await prisma.category.update({ where: { id: categoryId }, data: { targetMarginBps: 3550 } });
    await prisma.product.update({ where: { id: productId }, data: { targetMarginBps: 2000 } });
    await prisma.productVariant.update({ where: { id: variantId }, data: { targetMarginBps: 4125 } });
  });

  after(async () => {
    try {
      await data.cleanup();
    } finally {
      await admin.cleanup();
      await vendedor.cleanup();
      await app.close();
      await prisma.$disconnect();
    }
  });

  test("categoria: ADMIN recebe targetMarginPercent (get e lista); VENDEDOR não", async () => {
    const a = await call(`/categories/${categoryId}`, admin);
    assert.equal(a.json().data.targetMarginPercent, 35.5);
    assert.equal("targetMarginBps" in a.json().data, false);
    const list = await call(`/categories?search=${encodeURIComponent(a.json().data.name)}`, admin);
    assert.equal(list.json().data[0].targetMarginPercent, 35.5);
    const v = await call(`/categories/${categoryId}`, vendedor);
    assert.equal(v.statusCode, 200);
    assert.equal("targetMarginPercent" in v.json().data, false);
    assert.equal("targetMarginBps" in v.json().data, false);
    const vl = await call(`/categories?search=${encodeURIComponent(a.json().data.name)}`, vendedor);
    assert.equal("targetMarginPercent" in vl.json().data[0], false);
  });

  test("produto: ADMIN recebe targetMarginPercent (get e lista); VENDEDOR não", async () => {
    const a = await call(`/products/${productId}`, admin);
    assert.equal(a.json().data.targetMarginPercent, 20);
    assert.equal("targetMarginBps" in a.json().data, false);
    const list = await call(`/products?categoryId=${categoryId}`, admin);
    assert.equal(list.json().data[0].targetMarginPercent, 20);
    const v = await call(`/products/${productId}`, vendedor);
    assert.equal("targetMarginPercent" in v.json().data, false);
    assert.equal("targetMarginBps" in v.json().data, false);
    const vl = await call(`/products?categoryId=${categoryId}`, vendedor);
    assert.equal("targetMarginPercent" in vl.json().data[0], false);
  });

  test("variante: ADMIN recebe número ou null; VENDEDOR não (get, lista e código de barras)", async () => {
    const a = await call(`/variants/${variantId}`, admin);
    assert.equal(a.json().data.targetMarginPercent, 41.25);
    const unset = await call(`/variants/${unsetVariantId}`, admin);
    assert.equal(unset.json().data.targetMarginPercent, null);
    const list = await call(`/products/${productId}/variants`, admin);
    const byId = new Map(list.json().data.map((x: { id: string; targetMarginPercent: number | null }) => [x.id, x]));
    assert.equal((byId.get(variantId) as any).targetMarginPercent, 41.25);
    const v = await call(`/variants/${variantId}`, vendedor);
    assert.equal(v.statusCode, 200);
    assert.equal("targetMarginPercent" in v.json().data, false);
    assert.equal("targetMarginBps" in v.json().data, false);
    const vl = await call(`/products/${productId}/variants`, vendedor);
    assert.equal(vl.json().data.some((x: object) => "targetMarginPercent" in x || "targetMarginBps" in x), false);
  });
});
