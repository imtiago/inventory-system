import "dotenv/config";
import { after, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { prisma } from "@shared/prisma";
import { app } from "../../../../../app";
import { createTestUser, TestUser } from "../../../../../test/authFixtures";
import { createTestVariant } from "../../../../../test/inventoryFixtures";
import { acquirePricingTestLock } from "../../../../../test/pricingTestLock";
import { keyShape } from "../../../../../test/keyShape";
import { priceWithCardFee } from "@pricing/domain/cardFees";

app.log.level = "silent";

const FIXTURES_DIR = new URL("../../../../../../../frontend/src/test/fixtures/pricing/", import.meta.url);
const loadFixture = (name: string): unknown => JSON.parse(readFileSync(new URL(`${name}.json`, FIXTURES_DIR), "utf8"));

const credit = (v: Record<string, number> = {}) => {
  const base: Record<string, number> = {};
  for (let i = 1; i <= 12; i++) base[String(i)] = 0;
  return { ...base, ...v };
};
const settingsBody = (over: Record<string, unknown> = {}) => ({
  defaultMarginPercent: 40,
  roundingStrategy: "STORE_TABLE",
  alertThresholdPercent: 2,
  cardFees: { debitPercent: 1.99, creditPercent: credit({ "3": 4.99 }) },
  ...over,
});

describe("Composição do preço da variante (/pricing/variants)", () => {
  const users = {} as Record<"ADMIN" | "VENDEDOR", TestUser>;
  let variantId: string;
  let productId: string;
  let categoryId: string;
  let cleanupVariant: () => Promise<void>;
  let releaseLock: () => Promise<void>;

  const call = (role: keyof typeof users, method: "GET" | "PUT" | "POST", url: string, payload?: unknown) =>
    app.inject({ method, url, payload: payload as any, headers: { authorization: `Bearer ${users[role].token}` } });
  const admin = (method: "GET" | "PUT" | "POST", url: string, payload?: unknown) => call("ADMIN", method, url, payload);

  async function setup(configure = true) {
    await prisma.pricingExpense.deleteMany({});
    await prisma.pricingSettings.deleteMany({});
    await prisma.productVariant.update({
      where: { id: variantId },
      data: { salePrice: 20.9, targetMarginBps: null, supplierSuggestedPrice: null, supplierSuggestedPriceUpdatedAt: null },
    });
    await prisma.product.update({ where: { id: productId }, data: { targetMarginBps: null } });
    await prisma.category.update({ where: { id: categoryId }, data: { targetMarginBps: null } });
    await prisma.inventory.upsert({
      where: { productVariantId: variantId },
      create: { productVariantId: variantId, averageCost: 10 },
      update: { averageCost: 10 },
    });
    if (configure) {
      assert.equal((await admin("PUT", "/pricing/settings", settingsBody())).statusCode, 200);
      assert.equal((await admin("POST", "/pricing/expenses", { name: "Despesas", percent: 20 })).statusCode, 201);
      assert.equal((await admin("PUT", `/pricing/target-margins/category/${categoryId}`, { targetMarginPercent: 30 })).statusCode, 200);
    }
  }

  before(async () => {
    releaseLock = await acquirePricingTestLock();
    for (const role of ["ADMIN", "VENDEDOR"] as const) users[role] = await createTestUser({ role });
    ({ variantId, cleanup: cleanupVariant } = await createTestVariant());
    const v = await prisma.productVariant.findUniqueOrThrow({ where: { id: variantId }, include: { product: true } });
    productId = v.productId;
    categoryId = v.product.categoryId;
  });

  beforeEach(() => setup());

  after(async () => {
    try {
      await prisma.pricingExpense.deleteMany({});
      await prisma.pricingSettings.deleteMany({});
      await cleanupVariant();
      for (const u of Object.values(users)) await u?.cleanup();
    } finally {
      await releaseLock?.();
      await app.close();
      await prisma.$disconnect();
    }
  });

  test("composição: custo 10,0000, despesas 20%, margem da categoria 30% → sugerido 20,90, source CATEGORY; margem real ao preço praticado", async () => {
    const res = await admin("GET", `/pricing/variants/${variantId}`);
    assert.equal(res.statusCode, 200, res.body);
    const d = res.json().data;
    assert.equal(d.variantId, variantId);
    assert.equal(d.averageCost, 10);
    assert.equal(d.expensesPercent, 20);
    assert.equal(d.targetMarginPercent, 30);
    assert.equal(d.targetMarginSource, "CATEGORY");
    assert.equal(d.suggestedPrice, 20.9);
    assert.equal(d.salePrice, 20.9);
    assert.equal(d.expensesAmount, 4.18);
    assert.deepEqual(d.realMargin, { amount: 6.72, percent: 32.15 });
    assert.equal(d.supplierSuggestedPrice, null);
    assert.equal(d.supplierMargin, null);
  });

  test("sem nenhuma margem de nível → STORE; variante com margem própria vence produto e categoria", async () => {
    await prisma.category.update({ where: { id: categoryId }, data: { targetMarginBps: null } });
    let d = (await admin("GET", `/pricing/variants/${variantId}`)).json().data;
    assert.equal(d.targetMarginSource, "STORE");
    assert.equal(d.targetMarginPercent, 40);
    await admin("PUT", `/pricing/target-margins/category/${categoryId}`, { targetMarginPercent: 30 });
    await admin("PUT", `/pricing/target-margins/product/${productId}`, { targetMarginPercent: 35 });
    d = (await admin("GET", `/pricing/variants/${variantId}`)).json().data;
    assert.equal(d.targetMarginSource, "PRODUCT");
    assert.equal(d.targetMarginPercent, 35);
    await admin("PUT", `/pricing/target-margins/variant/${variantId}`, { targetMarginPercent: 50 });
    d = (await admin("GET", `/pricing/variants/${variantId}`)).json().data;
    assert.equal(d.targetMarginSource, "VARIANT");
    assert.equal(d.targetMarginPercent, 50);
    // 10 / (1 − 0,20 − 0,50) = 33,33 → tabela da loja 33,90
    assert.equal(d.suggestedPrice, 33.9);
  });

  test("revista 25,00 → supplierMargin calculada; 'usar preço da revista' grava salePrice 25,00", async () => {
    const put = await admin("PUT", `/pricing/variants/${variantId}/supplier-price`, { supplierSuggestedPrice: 25 });
    assert.equal(put.statusCode, 200, put.body);
    const d = put.json().data;
    assert.equal(d.supplierSuggestedPrice, 25);
    assert.ok(typeof d.supplierSuggestedPriceUpdatedAt === "string");
    assert.deepEqual(d.supplierMargin, { amount: 10, percent: 40 });

    const apply = await admin("POST", `/pricing/variants/${variantId}/apply-price`, { source: "SUPPLIER" });
    assert.equal(apply.statusCode, 200, apply.body);
    assert.equal(apply.json().data.salePrice, 25);
    const row = await prisma.productVariant.findUniqueOrThrow({ where: { id: variantId } });
    assert.equal(Number(row.salePrice), 25);

    const clear = await admin("PUT", `/pricing/variants/${variantId}/supplier-price`, { supplierSuggestedPrice: null });
    assert.equal(clear.statusCode, 200, clear.body);
    assert.equal(clear.json().data.supplierSuggestedPrice, null);
    assert.equal(clear.json().data.supplierSuggestedPriceUpdatedAt, null);
    const bad = await admin("PUT", `/pricing/variants/${variantId}/supplier-price`, { supplierSuggestedPrice: 0 });
    assert.equal(bad.statusCode, 400, bad.body);
    const bad3 = await admin("PUT", `/pricing/variants/${variantId}/supplier-price`, { supplierSuggestedPrice: 1.234 });
    assert.equal(bad3.statusCode, 400, bad3.body);
    const noRev = await admin("POST", `/pricing/variants/${variantId}/apply-price`, { source: "SUPPLIER" });
    assert.equal(noRev.statusCode, 422, noRev.body);
    assert.equal(noRev.json().code, "SUPPLIER_PRICE_UNAVAILABLE");
  });

  test("apply SUGGESTED grava o preço sugerido", async () => {
    await prisma.productVariant.update({ where: { id: variantId }, data: { salePrice: 12 } });
    const apply = await admin("POST", `/pricing/variants/${variantId}/apply-price`, { source: "SUGGESTED" });
    assert.equal(apply.statusCode, 200, apply.body);
    assert.equal(apply.json().data.salePrice, 20.9);
    assert.equal((await admin("POST", `/pricing/variants/${variantId}/apply-price`, { source: "X" })).statusCode, 400);
  });

  test("simulações: 27 linhas; crédito 3x com taxa 4,99% e repasse → price = priceWithCardFee(salePrice, 499)", async () => {
    const d = (await admin("GET", `/pricing/variants/${variantId}`)).json().data;
    assert.equal(d.simulations.length, 27);
    assert.equal(d.simulations[0].condition, "CASH");
    const row = d.simulations.find((s: any) => s.condition === "CREDIT" && s.installments === 3 && s.passOn);
    assert.equal(row.price, priceWithCardFee(2090, 499) / 100);
    const absorb = d.simulations.find((s: any) => s.condition === "CREDIT" && s.installments === 3 && !s.passOn);
    assert.equal(absorb.price, 20.9);
    // absorvendo: 2090 − 104 (4,99%) − 1000 − 418 = 568
    assert.equal(absorb.margin.amount, 5.68);
    assert.ok(row.margin.amount > absorb.margin.amount);
    const debit = d.simulations.filter((s: any) => s.condition === "DEBIT");
    assert.equal(debit.length, 2);
  });

  test("não configurado → suggestedPrice null; apply SUGGESTED → 422 SUGGESTED_PRICE_UNAVAILABLE", async () => {
    await setup(false);
    const d = (await admin("GET", `/pricing/variants/${variantId}`)).json().data;
    assert.equal(d.suggestedPrice, null);
    const apply = await admin("POST", `/pricing/variants/${variantId}/apply-price`, { source: "SUGGESTED" });
    assert.equal(apply.statusCode, 422, apply.body);
    assert.equal(apply.json().code, "SUGGESTED_PRICE_UNAVAILABLE");
  });

  test("custo 0 → suggestedPrice null", async () => {
    await prisma.inventory.update({ where: { productVariantId: variantId }, data: { averageCost: 0 } });
    const d = (await admin("GET", `/pricing/variants/${variantId}`)).json().data;
    assert.equal(d.suggestedPrice, null);
    assert.equal(d.averageCost, 0);
    const apply = await admin("POST", `/pricing/variants/${variantId}/apply-price`, { source: "SUGGESTED" });
    assert.equal(apply.json().code, "SUGGESTED_PRICE_UNAVAILABLE");
  });

  test("variante inexistente → 404 VARIANT_NOT_FOUND; id inválido → 400", async () => {
    const res = await admin("GET", "/pricing/variants/00000000-0000-4000-8000-000000000000");
    assert.equal(res.statusCode, 404, res.body);
    assert.equal(res.json().code, "VARIANT_NOT_FOUND");
    assert.equal((await admin("PUT", "/pricing/variants/00000000-0000-4000-8000-000000000000/supplier-price", { supplierSuggestedPrice: 5 })).statusCode, 404);
    assert.equal((await admin("GET", "/pricing/variants/abc")).statusCode, 400);
  });

  test("VENDEDOR: rotas de preço → 403; GET /variants/:id continua sem custo/margem", async () => {
    assert.equal((await call("VENDEDOR", "GET", `/pricing/variants/${variantId}`)).statusCode, 403);
    assert.equal((await call("VENDEDOR", "PUT", `/pricing/variants/${variantId}/supplier-price`, { supplierSuggestedPrice: 9 })).statusCode, 403);
    assert.equal((await call("VENDEDOR", "POST", `/pricing/variants/${variantId}/apply-price`, { source: "SUGGESTED" })).statusCode, 403);
    for (const url of [`/variants/${variantId}`]) {
      const res = await call("VENDEDOR", "GET", url);
      assert.equal(res.statusCode, 200, res.body);
      const body = res.body.toLowerCase();
      for (const word of ["cost", "margin", "profit", "supplier"]) assert.ok(!body.includes(word), `${url} vazou "${word}"`);
    }
    const row = await prisma.productVariant.findUniqueOrThrow({ where: { id: variantId } });
    assert.equal(row.supplierSuggestedPrice, null);
  });

  test("forma do DTO = fixture variantPricing.json (keyShape)", async () => {
    await admin("PUT", `/pricing/variants/${variantId}/supplier-price`, { supplierSuggestedPrice: 25 });
    const res = await admin("GET", `/pricing/variants/${variantId}`);
    assert.deepEqual(keyShape(res.json()), keyShape(loadFixture("variantPricing")));
  });
});
