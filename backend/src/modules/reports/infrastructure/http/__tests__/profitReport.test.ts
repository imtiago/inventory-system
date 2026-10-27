import "dotenv/config";
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { prisma } from "@shared/prisma";
import { applyBps } from "@shared/domain/percent";
import { toCents } from "@shared/domain/money";
import { PrismaPricingSettingsReader } from "@pricing/infrastructure/prisma/PrismaPricingSettingsReader";
import { app } from "../../../../../app";
import { keyShape } from "../../../../../test/keyShape";
import { parseCsv } from "../../../../../test/csvParse";
import { createTestUser, TestUser } from "../../../../../test/authFixtures";
import { createTestVariant } from "../../../../../test/inventoryFixtures";

const FIXTURE = new URL("../../../../../../../frontend/src/test/fixtures/reports/profit.json", import.meta.url);

app.log.level = "silent";

// Janela exclusiva (ano 2097): outras suítes rodam em paralelo no mesmo banco.
const pad = (n: number) => String(n).padStart(2, "0");
const month = pad(1 + Math.floor(Math.random() * 12));
const D1 = `2097-${month}-10`;
const D2 = `2097-${month}-11`;

/* eslint-disable @typescript-eslint/no-explicit-any */
describe("GET /reports/profit", () => {
  let admin: TestUser;
  let seller: TestUser;
  let other: TestUser;
  let customerId: string;
  const variants: { variantId: string; cleanup(): Promise<void> }[] = [];
  const saleIds: string[] = [];

  const get = (user: TestUser, url: string) =>
    app.inject({ method: "GET", url, headers: { authorization: `Bearer ${user.token}` } });
  const profit = async (query: string): Promise<{ rows: any[]; totals: any }> => {
    const res = await get(admin, `/reports/profit?from=${D1}&to=${D2}&${query}`);
    assert.equal(res.statusCode, 200, res.body);
    return res.json().data;
  };

  const createSale = async (
    status: "COMPLETED" | "CANCELED",
    createdAt: string,
    sellerId: string,
    items: { variantId: string; quantity: number; unitPrice: number; unitCost: number | null }[],
  ) => {
    const sale = await prisma.sale.create({
      data: {
        customerId,
        sellerId,
        status,
        createdAt: new Date(createdAt),
        totalAmount: items.reduce((s, i) => s + i.quantity * i.unitPrice, 0),
        items: {
          create: items.map((i) => ({
            productVariantId: i.variantId,
            productName: "tx-test",
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            unitCost: i.unitCost,
          })),
        },
      },
    });
    saleIds.push(sale.id);
  };

  before(async () => {
    admin = await createTestUser({ role: "ADMIN" });
    seller = await createTestUser({ role: "VENDEDOR" });
    other = await createTestUser({ role: "VENDEDOR" });
    customerId = (await prisma.customer.create({ data: { name: "tx-test", code: `tx-${randomUUID()}` } })).id;
    for (let i = 0; i < 2; i++) variants.push(await createTestVariant());
    const [v1, v2] = variants.map((v) => v.variantId);
    // S1 (D1, vendedor): v1 2×10,00 custo 4,0000; v2 1×5,50 custo 1,3333 → receita 25,50, custo 9,3333
    await createSale("COMPLETED", `${D1}T12:00:00-03:00`, seller.id, [
      { variantId: v1, quantity: 2, unitPrice: 10, unitCost: 4 },
      { variantId: v2, quantity: 1, unitPrice: 5.5, unitCost: 1.3333 },
    ]);
    // S2 (D2 23h30 BRT, outro vendedor): venda antiga, sem custo registrado → receita 30, custo 0
    await createSale("COMPLETED", `${D2}T23:30:00-03:00`, other.id, [
      { variantId: v1, quantity: 3, unitPrice: 10, unitCost: null },
    ]);
    // cancelada: não entra
    await createSale("CANCELED", `${D1}T15:00:00-03:00`, seller.id, [
      { variantId: v1, quantity: 100, unitPrice: 10, unitCost: 1 },
    ]);
  });

  after(async () => {
    await prisma.sale.deleteMany({ where: { id: { in: saleIds } } });
    for (const v of variants) await v.cleanup();
    await prisma.customer.deleteMany({ where: { id: customerId } });
    await Promise.all([admin, seller, other].map((u) => u.cleanup()));
    await prisma.$disconnect();
  });

  test("view=period: venda antiga (custo NULL) tem itemsWithoutCost 1 e custo 0; cancelada não entra", async () => {
    const bps = (await new PrismaPricingSettingsReader().get()).expensesBps;
    const { rows, totals } = await profit("view=period");
    assert.deepEqual(rows.map((r) => r.key), [D1, D2]);
    const [d1, d2] = rows;
    assert.equal(d1.revenue, 25.5);
    assert.equal(d1.cost, 9.33);
    assert.equal(d1.itemsWithoutCost, 0);
    assert.equal(d2.revenue, 30);
    assert.equal(d2.cost, 0);
    assert.equal(d2.itemsWithoutCost, 1);
    assert.equal(totals.revenue, 55.5);
    assert.equal(totals.cost, 9.33);
    assert.equal(totals.itemsWithoutCost, 1);
    const afterBps = (await new PrismaPricingSettingsReader().get()).expensesBps;
    if (bps === afterBps) {
      const expenses = (rev: number) => applyBps(toCents(rev), bps) / 100;
      assert.equal(d1.estimatedExpenses, expenses(25.5));
      assert.equal(d2.estimatedExpenses, expenses(30));
      assert.equal(totals.estimatedExpenses, Math.round((d1.estimatedExpenses + d2.estimatedExpenses) * 100) / 100);
      assert.equal(
        totals.profit,
        Math.round((totals.revenue - totals.cost - totals.estimatedExpenses) * 100) / 100,
      );
      assert.equal(d1.marginPercent, Math.round((d1.profit / d1.revenue) * 10_000) / 100);
    }
  });

  test("views sale/variant/category somam igual ao total; filtro sellerId", async () => {
    const base = await profit("view=period");
    for (const view of ["sale", "variant", "category"]) {
      const { rows, totals } = await profit(`view=${view}`);
      assert.ok(rows.length >= 2, view);
      const sum = (k: string) => Math.round(rows.reduce((s, r) => s + r[k], 0) * 100) / 100;
      assert.equal(sum("revenue"), totals.revenue, view);
      assert.equal(sum("cost"), totals.cost, view);
      assert.equal(sum("estimatedExpenses"), totals.estimatedExpenses, view);
      assert.equal(sum("profit"), totals.profit, view);
      assert.equal(totals.revenue, base.totals.revenue, view);
      assert.equal(totals.cost, base.totals.cost, view);
      assert.equal(totals.itemsWithoutCost, base.totals.itemsWithoutCost, view);
    }
    assert.equal((await profit("view=sale")).rows.length, 2);
    assert.equal((await profit("view=variant")).rows.length, 2);
    assert.equal((await profit("view=category")).rows.length, 2);

    const mine = await profit(`view=sale&sellerId=${seller.id}`);
    assert.equal(mine.rows.length, 1);
    assert.equal(mine.totals.revenue, 25.5);
    assert.equal(mine.totals.itemsWithoutCost, 0);
    const theirs = await profit(`view=period&sellerId=${other.id}`);
    assert.equal(theirs.totals.revenue, 30);
    assert.equal(theirs.totals.itemsWithoutCost, 1);
  });

  test("período sem vendas: totais zerados, margem null", async () => {
    const res = await get(admin, `/reports/profit?from=2096-01-01&to=2096-01-02&view=period`);
    assert.equal(res.statusCode, 200, res.body);
    const { rows, totals } = res.json().data;
    assert.deepEqual(rows, []);
    assert.equal(totals.revenue, 0);
    assert.equal(totals.marginPercent, null);
  });

  test("contrato: forma da resposta confere com a fixture do front", async () => {
    const res = await get(admin, `/reports/profit?from=${D1}&to=${D2}&view=period`);
    const fixture = JSON.parse(readFileSync(FIXTURE, "utf8"));
    assert.deepEqual(keyShape(res.json()), keyShape(fixture));
  });

  test("filtros inválidos → 400", async () => {
    assert.equal((await get(admin, "/reports/profit?from=2097-02-01&to=2097-01-01")).statusCode, 400);
    assert.equal((await get(admin, `/reports/profit?from=${D1}&to=${D2}&view=banana`)).statusCode, 400);
    assert.equal((await get(admin, `/reports/profit?from=${D1}&to=${D2}&sellerId=x`)).statusCode, 400);
  });

  test("CSV: BOM, ';', vírgula decimal, cabeçalho e linha de total", async () => {
    const res = await get(admin, `/reports/profit.csv?from=${D1}&to=${D2}&view=period`);
    assert.equal(res.statusCode, 200, res.body);
    assert.match(String(res.headers["content-type"]), /text\/csv/);
    assert.match(String(res.headers["content-disposition"]), /lucro-\d{4}-\d{2}-\d{2}\.csv/);
    assert.ok(res.body.startsWith("﻿"));
    const rows = parseCsv(res.body);
    assert.deepEqual(rows[0].slice(1), [
      "Receita",
      "Custo",
      "Despesas estimadas",
      "Lucro",
      "Margem (%)",
      "Custo não registrado",
    ]);
    const d1 = rows.find((r) => r[0] === "10/".concat(`${month}/2097`));
    assert.ok(d1, res.body);
    assert.equal(d1[1], "25,50");
    assert.equal(d1[2], "9,33");
    assert.equal(d1[6], "0");
    const d2 = rows.find((r) => r[0] === `11/${month}/2097`);
    assert.equal(d2?.[6], "1");
    assert.equal(rows.at(-1)?.[0], "Total");
    assert.equal(rows.at(-1)?.[1], "55,50");
  });

  test("VENDEDOR: GET /reports/profit e .csv → 403", async () => {
    assert.equal((await get(seller, `/reports/profit?from=${D1}&to=${D2}`)).statusCode, 403);
    assert.equal((await get(seller, `/reports/profit.csv?from=${D1}&to=${D2}`)).statusCode, 403);
    assert.equal((await app.inject({ method: "GET", url: `/reports/profit?from=${D1}&to=${D2}` })).statusCode, 401);
  });
});
