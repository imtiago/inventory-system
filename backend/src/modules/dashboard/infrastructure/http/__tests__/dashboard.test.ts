import "dotenv/config";
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { prisma } from "@shared/prisma";
import { todayInBusinessTz } from "@shared/domain/businessDate";
import { app } from "../../../../../app";
import { keyShape } from "../../../../../test/keyShape";
import { createTestUser, TestUser } from "../../../../../test/authFixtures";
import { createTestVariant, getTestUserId } from "../../../../../test/inventoryFixtures";

const FIXTURE = new URL("../../../../../../../frontend/src/test/fixtures/dashboard/dashboard.json", import.meta.url);

app.log.level = "silent";

const TODAY = todayInBusinessTz();
const addDays = (days: number) => {
  const d = new Date(`${TODAY}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const asDate = (day: string) => new Date(`${day}T00:00:00.000Z`);
const round2 = (n: number) => Math.round(n * 100) / 100;

/* eslint-disable @typescript-eslint/no-explicit-any */
type Dash = any;

describe("Dashboard (GET /dashboard)", () => {
  let admin: TestUser;
  let vendedor: TestUser;
  let estoquista: TestUser;
  let userId: string;
  let customerId: string;
  let supplierId: string;
  const variants: { variantId: string; cleanup(): Promise<void> }[] = [];
  const saleIds: string[] = [];
  const docIds: string[] = [];
  const purchaseIds: string[] = [];
  const lotInventoryIds: string[] = [];

  const read = async (user: TestUser): Promise<Dash> => {
    const res = await app.inject({
      method: "GET",
      url: "/dashboard",
      headers: { authorization: `Bearer ${user.token}` },
    });
    assert.equal(res.statusCode, 200, res.body);
    return res.json().data;
  };

  const createSale = async (
    status: "COMPLETED" | "CANCELED",
    createdAt: Date,
    items: { variantId: string; quantity: number; unitPrice: number }[],
  ) => {
    const total = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
    const sale = await prisma.sale.create({
      data: {
        customerId,
        status,
        totalAmount: total,
        createdAt,
        items: {
          create: items.map((i) => ({
            productVariantId: i.variantId,
            productName: "tx-test",
            quantity: i.quantity,
            unitPrice: i.unitPrice,
          })),
        },
      },
    });
    saleIds.push(sale.id);
  };

  const createDoc = async (
    type: "RECEIVABLE" | "PAYABLE",
    status: "OPEN" | "PAID" | "CANCELED",
    parcels: { amount: number; dueDate: string; paid?: number; reversedPaid?: number }[],
  ) => {
    const doc = await prisma.financialDocument.create({
      data: {
        type,
        originType: type === "RECEIVABLE" ? "SALE" : "PURCHASE",
        originId: randomUUID(),
        partyId: randomUUID(),
        partyType: type === "RECEIVABLE" ? "CUSTOMER" : "SUPPLIER",
        status,
      },
    });
    docIds.push(doc.id);
    for (const p of parcels) {
      const payments = [];
      if (p.paid) payments.push({ amount: p.paid });
      if (p.reversedPaid) payments.push({ amount: p.reversedPaid, reversedAt: new Date(), reversedById: userId });
      await prisma.financialParcel.create({
        data: {
          financialDocumentId: doc.id,
          amount: p.amount,
          dueDate: asDate(p.dueDate),
          payments: {
            create: payments.map((pay) => ({
              ...pay,
              method: "PIX" as const,
              paymentDate: asDate(TODAY),
              createdById: userId,
            })),
          },
        },
      });
    }
  };

  before(async () => {
    admin = await createTestUser({ role: "ADMIN" });
    vendedor = await createTestUser({ role: "VENDEDOR" });
    estoquista = await createTestUser({ role: "ESTOQUISTA" });
    userId = await getTestUserId();
    customerId = (await prisma.customer.create({ data: { name: "tx-test", code: `tx-${randomUUID()}` } })).id;
    supplierId = (await prisma.supplier.create({ data: { name: "tx-test", document: `tx-${randomUUID()}` } })).id;
    for (let i = 0; i < 4; i++) variants.push(await createTestVariant());
  });

  after(async () => {
    await prisma.sale.deleteMany({ where: { id: { in: saleIds } } });
    await prisma.financialDocument.deleteMany({ where: { id: { in: docIds } } });
    await prisma.purchase.deleteMany({ where: { id: { in: purchaseIds } } });
    for (const v of variants) await v.cleanup();
    await prisma.customer.deleteMany({ where: { id: customerId } });
    await prisma.supplier.deleteMany({ where: { id: supplierId } });
    await Promise.all([admin, vendedor, estoquista].map((u) => u.cleanup()));
    await prisma.$disconnect();
  });

  test("exige autenticação", async () => {
    const res = await app.inject({ method: "GET", url: "/dashboard" });
    assert.equal(res.statusCode, 401);
  });

  test("vendas: hoje e mês por delta; cancelada não conta; venda 23h30 BRT conta hoje; last7Days e topVariants", async () => {
    const before = await read(admin);
    assert.equal(before.sales.last7Days.length, 7);
    assert.equal(before.sales.last7Days[6].date, TODAY);
    assert.equal(before.sales.last7Days[0].date, addDays(-6));

    const [va, vb] = variants;
    const yesterday = addDays(-1);
    // 23h30 em Brasília de hoje = 02h30 UTC de amanhã: não pode cair no dia seguinte.
    await createSale("COMPLETED", new Date(`${TODAY}T23:30:00-03:00`), [
      { variantId: va.variantId, quantity: 1_000_000, unitPrice: 1.1 },
    ]);
    // 00h10 em Brasília de hoje = 03h10 UTC de hoje: não pode cair em ontem.
    await createSale("COMPLETED", new Date(`${TODAY}T00:10:00-03:00`), [
      { variantId: vb.variantId, quantity: 500_000, unitPrice: 0.1 },
    ]);
    // ontem ao meio-dia
    await createSale("COMPLETED", new Date(`${yesterday}T12:00:00-03:00`), [
      { variantId: vb.variantId, quantity: 2, unitPrice: 10 },
    ]);
    // cancelada hoje: não conta
    await createSale("CANCELED", new Date(`${TODAY}T10:00:00-03:00`), [
      { variantId: vb.variantId, quantity: 9_000_000, unitPrice: 5 },
    ]);

    const after = await read(admin);
    const todayTotal = 1_000_000 * 1.1 + 500_000 * 0.1;
    assert.equal(after.sales.today.count - before.sales.today.count, 2);
    assert.equal(round2(after.sales.today.total - before.sales.today.total), round2(todayTotal));

    const yesterdayInMonth = yesterday.slice(0, 7) === TODAY.slice(0, 7);
    assert.equal(after.sales.month.count - before.sales.month.count, yesterdayInMonth ? 3 : 2);
    assert.equal(
      round2(after.sales.month.total - before.sales.month.total),
      round2(todayTotal + (yesterdayInMonth ? 20 : 0)),
    );

    const d6 = after.sales.last7Days[6];
    const d5 = after.sales.last7Days[5];
    const b6 = before.sales.last7Days[6];
    const b5 = before.sales.last7Days[5];
    assert.equal(d6.count - b6.count, 2);
    assert.equal(round2(d6.total - b6.total), round2(todayTotal));
    assert.equal(d5.count - b5.count, 1);
    assert.equal(round2(d5.total - b5.total), 20);

    const top = after.sales.topVariants;
    assert.ok(top.length <= 5);
    assert.equal(top[0].productVariantId, va.variantId);
    assert.equal(top[0].quantity, 1_000_000);
    assert.equal(top[0].total, 1_100_000);
    assert.match(top[0].label, / — /);
    const second = top.find((t: any) => t.productVariantId === vb.variantId);
    assert.ok(second, "variante vb no top do mês");
    assert.equal(second.quantity, 500_000 + (yesterdayInMonth ? 2 : 0));
    assert.equal(second.total, round2(50_000 + (yesterdayInMonth ? 20 : 0)));
  });

  test("last7Days: sempre 7 datas consecutivas terminando hoje, com 0 onde não há venda", async () => {
    const data = await read(admin);
    const days: any[] = data.sales.last7Days;
    assert.deepEqual(
      days.map((d) => d.date),
      [-6, -5, -4, -3, -2, -1, 0].map(addDays),
    );
    for (const d of days) {
      assert.equal(typeof d.count, "number");
      assert.equal(typeof d.total, "number");
    }
  });

  for (const [type, key] of [
    ["RECEIVABLE", "receivables"],
    ["PAYABLE", "payables"],
  ] as const) {
    test(`${key}: open, overdue e dueNext7Days usam o restante; pago, estornado e cancelado`, async () => {
      const before = await read(admin);
      await createDoc(type, "OPEN", [
        { amount: 100, dueDate: addDays(-1), paid: 30 }, // restante 70, vencida
        { amount: 40, dueDate: addDays(-1), paid: 40 }, // paga: não conta
        { amount: 50, dueDate: addDays(3) }, // restante 50, próximos 7 dias
        { amount: 10, dueDate: TODAY }, // hoje: próximos 7, não vencida
        { amount: 30, dueDate: addDays(8) }, // fora dos 7 dias
        { amount: 200, dueDate: addDays(10), reversedPaid: 20 }, // pagamento estornado não abate
      ]);
      await createDoc(type, "CANCELED", [{ amount: 999, dueDate: addDays(-1) }]);
      const after = await read(admin);
      const b = before[key];
      const a = after[key];
      assert.equal(round2(a.open - b.open), 70 + 50 + 10 + 30 + 200);
      assert.equal(round2(a.overdue - b.overdue), 70);
      assert.equal(a.dueNext7Days.count - b.dueNext7Days.count, 2);
      assert.equal(round2(a.dueNext7Days.amount - b.dueNext7Days.amount), 60);
    });
  }

  test("estoque: variante zerada entra; lote vencendo em 30 dias entra, vencido/fora do prazo/zerado não", async () => {
    const [v0, v1, v2, v3] = variants;
    const before = await read(admin);

    const mkInv = (variantId: string, quantity: number) =>
      prisma.inventory.create({ data: { productVariantId: variantId, quantity } });
    const mkLot = (inventoryId: string, variantId: string, batch: string, remaining: number, expiry: string) =>
      prisma.inventoryLot.create({
        data: {
          inventoryId,
          productVariantId: variantId,
          sourceType: "MANUAL",
          initialQuantity: 5,
          remainingQuantity: remaining,
          unitCost: 1,
          batchNumber: batch,
          expirationDate: asDate(expiry),
        },
      });

    const inv0 = await mkInv(v0.variantId, -1_000_000); // zerado/negativo: entra
    await mkInv(v1.variantId, 5); // com estoque: não entra
    const inv2 = await mkInv(v2.variantId, 20);
    const inv3 = await mkInv(v3.variantId, 20);
    lotInventoryIds.push(inv0.id, inv2.id, inv3.id);
    const inWindow = await mkLot(inv2.id, v2.variantId, "tx-in", 4, TODAY);
    await mkLot(inv2.id, v2.variantId, "tx-edge", 4, addDays(30)); // limite: entra
    await mkLot(inv2.id, v2.variantId, "tx-expired", 4, addDays(-1)); // vencido
    await mkLot(inv2.id, v2.variantId, "tx-far", 4, addDays(31)); // fora do prazo
    await mkLot(inv3.id, v3.variantId, "tx-empty", 0, addDays(5)); // zerado

    const after = await read(admin);
    assert.equal(after.inventory.outOfStockCount - before.inventory.outOfStockCount, 1);
    assert.ok(after.inventory.outOfStock.length <= 10);
    const out = after.inventory.outOfStock.find((i: any) => i.productVariantId === v0.variantId);
    assert.ok(out, "variante zerada na lista");
    assert.equal(out.quantity, -1_000_000);
    assert.match(out.label, / — /);
    assert.ok(!after.inventory.outOfStock.some((i: any) => i.productVariantId === v1.variantId));

    assert.equal(after.inventory.expiringLots.count - before.inventory.expiringLots.count, 2);
    assert.ok(after.inventory.expiringLots.items.length <= 5);
    const lot = after.inventory.expiringLots.items.find((i: any) => i.lotId === inWindow.id);
    assert.ok(lot, "lote vencendo hoje na lista");
    assert.equal(lot.batchNumber, "tx-in");
    assert.equal(lot.expirationDate, TODAY);
    assert.equal(lot.remainingQuantity, 4);
    assert.equal(lot.productVariantId, undefined);
    const dates: string[] = after.inventory.expiringLots.items.map((i: any) => i.expirationDate);
    assert.deepEqual(dates, [...dates].sort());
    for (const id of ["tx-expired", "tx-far", "tx-empty"]) {
      assert.ok(!after.inventory.expiringLots.items.some((i: any) => i.batchNumber === id));
    }
  });

  test("compras aguardando recebimento: PENDING e PARTIALLY_RECEIVED", async () => {
    const before = await read(admin);
    const mk = async (status: "PENDING" | "PARTIALLY_RECEIVED" | "RECEIVED" | "CANCELED", total: number) => {
      const p = await prisma.purchase.create({
        data: {
          code: `tx-${randomUUID()}`,
          supplierId,
          status,
          origin: "MANUAL",
          purchaseDate: asDate(TODAY),
          totalAmount: total,
        },
      });
      purchaseIds.push(p.id);
    };
    await mk("PENDING", 100.5);
    await mk("PARTIALLY_RECEIVED", 20.25);
    await mk("RECEIVED", 999);
    await mk("CANCELED", 5);
    const after = await read(admin);
    assert.equal(after.purchases.awaitingReceipt.count - before.purchases.awaitingReceipt.count, 2);
    assert.equal(round2(after.purchases.awaitingReceipt.total - before.purchases.awaitingReceipt.total), 120.75);
  });

  test("seções por papel", async () => {
    const v = await read(vendedor);
    assert.deepEqual(Object.keys(v).sort(), ["generatedAt", "inventory", "receivables", "sales"]);
    const e = await read(estoquista);
    assert.deepEqual(Object.keys(e).sort(), ["generatedAt", "inventory", "purchases"]);
    const a = await read(admin);
    assert.deepEqual(Object.keys(a).sort(), [
      "generatedAt",
      "inventory",
      "payables",
      "purchases",
      "receivables",
      "sales",
    ]);
  });

  test("chaves = fixture", async () => {
    const data = await read(admin);
    const fixture = JSON.parse(readFileSync(FIXTURE, "utf8"));
    assert.deepEqual(keyShape(data), keyShape(fixture.data));
  });
});
