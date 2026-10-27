import "dotenv/config";
import { after, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "@shared/prisma";
import { app } from "../../../../../app";
import { createTestUser, TestUser } from "../../../../../test/authFixtures";
import { createTestVariant } from "../../../../../test/inventoryFixtures";
import { PrismaPricingSettingsReader } from "@pricing/infrastructure/prisma/PrismaPricingSettingsReader";
import { acquirePricingTestLock } from "../../../../../test/pricingTestLock";
import { readFileSync } from "node:fs";
import { keyShape } from "../../../../../test/keyShape";
import { PrismaTargetMarginReader } from "@pricing/infrastructure/prisma/PrismaTargetMarginReader";

app.log.level = "silent";

const FIXTURES_DIR = new URL("../../../../../../../frontend/src/test/fixtures/pricing/", import.meta.url);
const loadFixture = (name: string): unknown => JSON.parse(readFileSync(new URL(`${name}.json`, FIXTURES_DIR), "utf8"));

const SUM_MESSAGE = "Despesas e margem somam 100% ou mais";
const credit = (v: Record<string, number> = {}) => {
  const base: Record<string, number> = {};
  for (let i = 1; i <= 12; i++) base[String(i)] = 0;
  return { ...base, ...v };
};
const settingsBody = (over: Record<string, unknown> = {}) => ({
  defaultMarginPercent: 30,
  roundingStrategy: "END_90",
  alertThresholdPercent: 2,
  cardFees: { debitPercent: 1.99, creditPercent: credit({ "1": 3.49, "12": 12.9 }) },
  ...over,
});

describe("Configurações de preço, despesas e margens", () => {
  const users = {} as Record<"ADMIN" | "VENDEDOR", TestUser>;
  const expenseIds: string[] = [];
  let variantId: string;
  let cleanupVariant: () => Promise<void>;
  let productId: string;
  let categoryId: string;

  const call = (role: keyof typeof users, method: "GET" | "POST" | "PUT" | "DELETE", url: string, payload?: unknown) =>
    app.inject({ method, url, payload: payload as any, headers: { authorization: `Bearer ${users[role].token}` } });
  const admin = (method: "GET" | "POST" | "PUT" | "DELETE", url: string, payload?: unknown) =>
    call("ADMIN", method, url, payload);

  async function reset() {
    await prisma.pricingExpense.deleteMany({});
    await prisma.pricingSettings.deleteMany({});
  }

  let releaseLock: () => Promise<void>;

  before(async () => {
    releaseLock = await acquirePricingTestLock();
    for (const role of ["ADMIN", "VENDEDOR"] as const) users[role] = await createTestUser({ role });
    ({ variantId, cleanup: cleanupVariant } = await createTestVariant());
    const v = await prisma.productVariant.findUniqueOrThrow({
      where: { id: variantId },
      include: { product: true },
    });
    productId = v.productId;
    categoryId = v.product.categoryId;
  });

  beforeEach(reset);

  after(async () => {
    try {
      await reset();
      await cleanupVariant();
      for (const u of Object.values(users)) await u?.cleanup();
    } finally {
      await releaseLock?.();
      await app.close();
      await prisma.$disconnect();
    }
  });

  test("GET sem configuração → configured false e padrões (alerta 2%, STORE_TABLE)", async () => {
    const res = await admin("GET", "/pricing/settings");
    assert.equal(res.statusCode, 200, res.body);
    const d = res.json().data;
    assert.equal(d.configured, false);
    assert.equal(d.defaultMarginPercent, 0);
    assert.equal(d.roundingStrategy, "STORE_TABLE");
    assert.equal(d.alertThresholdPercent, 2);
    assert.equal(d.cardFees.debitPercent, 0);
    assert.equal(d.cardFees.creditPercent["12"], 0);
    assert.deepEqual(d.expenses, []);
    assert.equal(d.expensesTotalPercent, 0);
    const snap = await new PrismaPricingSettingsReader().get();
    assert.equal(snap.configured, false);
    assert.equal(snap.alertThresholdBps, 200);
  });

  test("PUT salva margem 30%, débito 1,99%, crédito 1x 3,49% … 12x 12,9% → GET devolve os mesmos percentuais", async () => {
    const put = await admin("PUT", "/pricing/settings", settingsBody());
    assert.equal(put.statusCode, 200, put.body);
    const get = await admin("GET", "/pricing/settings");
    const d = get.json().data;
    assert.equal(d.configured, true);
    assert.equal(d.defaultMarginPercent, 30);
    assert.equal(d.roundingStrategy, "END_90");
    assert.equal(d.alertThresholdPercent, 2);
    assert.equal(d.cardFees.debitPercent, 1.99);
    assert.equal(d.cardFees.creditPercent["1"], 3.49);
    assert.equal(d.cardFees.creditPercent["12"], 12.9);
    assert.equal(Object.keys(d.cardFees.creditPercent).length, 12);
    const snap = await new PrismaPricingSettingsReader().get();
    assert.equal(snap.defaultMarginBps, 3000);
    assert.equal(snap.cardFees.debitBps, 199);
    assert.equal(snap.cardFees.creditBps[12], 1290);
  });

  test("PUT com despesas ativas 75% + margem 25% → 422 PRICING_PERCENT_SUM_TOO_HIGH", async () => {
    const e = await admin("POST", "/pricing/expenses", { name: "Grande", percent: 75 });
    assert.equal(e.statusCode, 201, e.body);
    const res = await admin("PUT", "/pricing/settings", settingsBody({ defaultMarginPercent: 25 }));
    assert.equal(res.statusCode, 422, res.body);
    assert.equal(res.json().code, "PRICING_PERCENT_SUM_TOO_HIGH");
    assert.equal(res.json().message, SUM_MESSAGE);
    const ok = await admin("PUT", "/pricing/settings", settingsBody({ defaultMarginPercent: 24.99 }));
    assert.equal(ok.statusCode, 200, ok.body);
  });

  test("POST despesa que faria a soma com a margem padrão ≥ 100% → 422; despesa inativa não conta", async () => {
    await admin("PUT", "/pricing/settings", settingsBody({ defaultMarginPercent: 30 }));
    const bad = await admin("POST", "/pricing/expenses", { name: "Enorme", percent: 70 });
    assert.equal(bad.statusCode, 422, bad.body);
    assert.equal(bad.json().code, "PRICING_PERCENT_SUM_TOO_HIGH");
    const inactive = await admin("POST", "/pricing/expenses", { name: "Inativa", percent: 90, active: false });
    assert.equal(inactive.statusCode, 201, inactive.body);
    const list = await admin("GET", "/pricing/expenses");
    assert.equal(list.json().data.length, 1);
    const get = await admin("GET", "/pricing/settings");
    assert.equal(get.json().data.expensesTotalPercent, 0);
    // reativar estoura a soma
    const react = await admin("PUT", `/pricing/expenses/${inactive.json().data.id}`, { name: "Inativa", percent: 90, active: true });
    assert.equal(react.statusCode, 422, react.body);
    // update que passa
    const ok = await admin("POST", "/pricing/expenses", { name: "Taxa", percent: 5 });
    assert.equal(ok.statusCode, 201);
    const upd = await admin("PUT", `/pricing/expenses/${ok.json().data.id}`, { name: "Taxa 2", percent: 6, active: true });
    assert.equal(upd.statusCode, 200, upd.body);
    assert.equal(upd.json().data.percent, 6);
    const snap = await new PrismaPricingSettingsReader().get();
    assert.equal(snap.expensesBps, 600);
    const del = await admin("DELETE", `/pricing/expenses/${ok.json().data.id}`);
    assert.equal(del.statusCode, 204, del.body);
    assert.equal((await admin("DELETE", `/pricing/expenses/${ok.json().data.id}`)).statusCode, 404);
    assert.equal((await admin("PUT", `/pricing/expenses/${randomUUID()}`, { name: "x", percent: 1 })).statusCode, 404);
  });

  test("criar despesa sem linha de configuração não marca como configurado", async () => {
    const e = await admin("POST", "/pricing/expenses", { name: "Aluguel", percent: 5 });
    assert.equal(e.statusCode, 201, e.body);
    assert.equal((await admin("GET", "/pricing/settings")).json().data.configured, false);
  });

  test("despesa por ajudante: Aluguel 1500 / faturamento 20000 → percentBps 750", async () => {
    const res = await admin("POST", "/pricing/expenses", { name: "Aluguel", monthlyAmount: 1500, monthlyRevenue: 20000 });
    assert.equal(res.statusCode, 201, res.body);
    assert.equal(res.json().data.percent, 7.5);
    const row = await prisma.pricingExpense.findUniqueOrThrow({ where: { id: res.json().data.id } });
    assert.equal(row.percentBps, 750);
    const bad = await admin("POST", "/pricing/expenses", { name: "X", monthlyAmount: 10, monthlyRevenue: 0 });
    assert.equal(bad.statusCode, 400, bad.body);
    const both = await admin("POST", "/pricing/expenses", { name: "X", percent: 1, monthlyAmount: 10, monthlyRevenue: 100 });
    assert.equal(both.statusCode, 400, both.body);
  });

  for (const [level, id] of [
    ["variant", () => variantId],
    ["product", () => productId],
    ["category", () => categoryId],
  ] as const) {
    test(`margem por ${level}: PUT grava, null remove, VENDEDOR → 403`, async () => {
      const url = `/pricing/target-margins/${level}/${id()}`;
      const put = await admin("PUT", url, { targetMarginPercent: 35.5 });
      assert.equal(put.statusCode, 200, put.body);
      assert.equal(put.json().data.targetMarginPercent, 35.5);
      const levels = await new PrismaTargetMarginReader().forVariant(variantId);
      assert.equal(levels[level], 3550);
      const del = await admin("PUT", url, { targetMarginPercent: null });
      assert.equal(del.statusCode, 200, del.body);
      assert.equal(del.json().data.targetMarginPercent, null);
      assert.equal((await new PrismaTargetMarginReader().forVariant(variantId))[level], null);
      const forbidden = await call("VENDEDOR", "PUT", url, { targetMarginPercent: 10 });
      assert.equal(forbidden.statusCode, 403, forbidden.body);
    });
  }

  test("margem por nível: inexistente → 404; nível inválido → 400; soma ≥ 100% → 422", async () => {
    assert.equal((await admin("PUT", `/pricing/target-margins/variant/${randomUUID()}`, { targetMarginPercent: 10 })).statusCode, 404);
    assert.equal((await admin("PUT", `/pricing/target-margins/foo/${variantId}`, { targetMarginPercent: 10 })).statusCode, 400);
    await admin("POST", "/pricing/expenses", { name: "Grande", percent: 60 });
    const res = await admin("PUT", `/pricing/target-margins/variant/${variantId}`, { targetMarginPercent: 40 });
    assert.equal(res.statusCode, 422, res.body);
    assert.equal(res.json().code, "PRICING_PERCENT_SUM_TOO_HIGH");
  });

  test("percentual com 3 casas → 400 no campo; fora de faixa → 400", async () => {
    const res = await admin("PUT", "/pricing/settings", settingsBody({ defaultMarginPercent: 30.123 }));
    assert.equal(res.statusCode, 400, res.body);
    assert.ok(res.json().errors.some((d: { field: string }) => d.field === "defaultMarginPercent"), res.body);
    const card = await admin("PUT", "/pricing/settings", settingsBody({ cardFees: { debitPercent: 1, creditPercent: credit({ "3": 2.555 }) } }));
    assert.equal(card.statusCode, 400, card.body);
    assert.ok(card.json().errors.some((d: { field: string }) => d.field === "cardFees.creditPercent.3"), card.body);
    const missing = credit();
    delete missing["7"];
    assert.equal((await admin("PUT", "/pricing/settings", settingsBody({ cardFees: { debitPercent: 1, creditPercent: missing } }))).statusCode, 400);
    assert.equal((await admin("PUT", "/pricing/settings", settingsBody({ defaultMarginPercent: 100 }))).statusCode, 400);
    assert.equal((await admin("POST", "/pricing/expenses", { name: "x", percent: 1.001 })).statusCode, 400);
  });

  test("JSON de taxas inválido no banco → 500 (invariante)", async () => {
    await prisma.pricingSettings.create({
      data: { id: "default", defaultMarginBps: 1000, cardFees: { debitBps: "x" } },
    });
    const res = await admin("GET", "/pricing/settings");
    assert.equal(res.statusCode, 500, res.body);
  });

  test("duas despesas simultâneas que juntas estouram 100% → só uma passa", async () => {
    await admin("PUT", "/pricing/settings", settingsBody({ defaultMarginPercent: 10 }));
    const results = await Promise.all([
      admin("POST", "/pricing/expenses", { name: "A", percent: 50 }),
      admin("POST", "/pricing/expenses", { name: "B", percent: 50 }),
    ]);
    const codes = results.map((r) => r.statusCode).sort();
    assert.deepEqual(codes, [201, 422], results.map((r) => r.body).join(" | "));
  });

  test("forma dos DTOs = fixtures pricingSettings, pricingExpense e targetMargin (keyShape)", async () => {
    await admin("PUT", "/pricing/settings", settingsBody());
    const created = await admin("POST", "/pricing/expenses", { name: "Aluguel", percent: 7.5 });
    const settings = await admin("GET", "/pricing/settings");
    assert.deepEqual(keyShape(settings.json()), keyShape(loadFixture("pricingSettings")));
    assert.deepEqual(keyShape(created.json()), keyShape(loadFixture("pricingExpense")));
    const margin = await admin("PUT", `/pricing/target-margins/category/${categoryId}`, { targetMarginPercent: 35 });
    assert.deepEqual(keyShape(margin.json()), keyShape(loadFixture("targetMargin")));
  });
});
