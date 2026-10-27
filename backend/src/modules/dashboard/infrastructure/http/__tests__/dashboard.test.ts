import "dotenv/config";
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { prisma } from "@shared/prisma";
import { applyBps } from "@shared/domain/percent";
import { PrismaPricingSettingsReader } from "@pricing/infrastructure/prisma/PrismaPricingSettingsReader";
import { getDb, runInTransactionContext } from "@shared/infrastructure/prisma/transactionContext";
import { deleteFinancialDocuments } from "../../../../../test/cleanup";
import { todayInBusinessTz } from "@shared/domain/businessDate";
import { app } from "../../../../../app";
import { keyShape } from "../../../../../test/keyShape";
import { createTestUser, TestUser } from "../../../../../test/authFixtures";
import { makeGetDashboardUseCase } from "../factories/GetDashboardFactory";
import { createTestVariant, getTestUserId } from "../../../../../test/inventoryFixtures";

const FIXTURE = new URL("../../../../../../../frontend/src/test/fixtures/dashboard/dashboard.json", import.meta.url);

app.log.level = "silent";

// Janela de datas exclusiva: um dia aleatório de 2099, para não colidir com dados reais
// (outras suítes rodam em paralelo no mesmo banco) nem com outra execução deste arquivo.
const pad = (n: number) => String(n).padStart(2, "0");
const TODAY = `2099-${pad(2 + Math.floor(Math.random() * 10))}-${pad(1 + Math.floor(Math.random() * 28))}`;
const NOW = new Date(`${TODAY}T15:00:00.000Z`); // 12h em Brasília
assert.equal(todayInBusinessTz(NOW), TODAY);
const addDays = (days: number) => {
  const d = new Date(`${TODAY}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const asDate = (day: string) => new Date(`${day}T00:00:00.000Z`);
const round2 = (n: number) => Math.round(n * 100) / 100;

class Rollback extends Error {}

/**
 * Roda `work` numa transação REPEATABLE READ que no fim é desfeita. O snapshot nasce na primeira
 * leitura e não enxerga o que outras suítes gravam em paralelo; as escritas do próprio teste, na
 * mesma transação, aparecem. Por isso a diferença entre duas leituras é exatamente o que o teste
 * criou (asserções com `===`, sem `>=`), e nada sobra no banco.
 */
async function isolated(work: () => Promise<void>): Promise<void> {
  try {
    await prisma.$transaction(
      async (tx) => {
        await runInTransactionContext(tx, work);
        throw new Rollback();
      },
      { isolationLevel: "RepeatableRead", timeout: 30_000, maxWait: 10_000 },
    );
  } catch (error) {
    if (!(error instanceof Rollback)) throw error;
  }
}

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

  const read = async (user: TestUser): Promise<Dash> => {
    const res = await app.inject({
      method: "GET",
      url: "/dashboard",
      headers: { authorization: `Bearer ${user.token}` },
    });
    assert.equal(res.statusCode, 200, res.body);
    return res.json().data;
  };

  // Leitura com "agora" injetado na janela de 2099.
  const readWindow = (): Promise<Dash> => makeGetDashboardUseCase().execute("ADMIN", NOW);

  const createSale = async (
    status: "COMPLETED" | "CANCELED",
    createdAt: Date,
    items: { variantId: string; quantity: number; unitPrice: number; unitCost?: number | null }[],
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
            unitCost: i.unitCost ?? null,
          })),
        },
      },
    });
    saleIds.push(sale.id);
  };

  const createDoc = async (
    type: "RECEIVABLE" | "PAYABLE",
    status: "OPEN" | "PARTIALLY_PAID" | "PAID" | "CANCELED",
    parcels: { amount: number; dueDate: string; paid?: number; reversedPaid?: number }[],
  ) => {
    const doc = await getDb().financialDocument.create({
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
      await getDb().financialParcel.create({
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
    await deleteFinancialDocuments({ where: { id: { in: docIds } } });
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
    const before = await readWindow();
    assert.equal(before.sales.last7Days.length, 7);
    assert.equal(before.sales.last7Days[6].date, TODAY);
    assert.equal(before.sales.last7Days[0].date, addDays(-6));

    const [va, vb, vc] = variants;
    const yesterday = addDays(-1);
    // 23h30 em Brasília de hoje = 02h30 UTC de amanhã: não pode cair no dia seguinte.
    await createSale("COMPLETED", new Date(`${TODAY}T23:30:00-03:00`), [
      { variantId: va.variantId, quantity: 1_000_000, unitPrice: 1.1 },
    ]);
    // 00h10 em Brasília de hoje = 03h10 UTC de hoje: não pode cair em ontem.
    await createSale("COMPLETED", new Date(`${TODAY}T00:10:00-03:00`), [
      { variantId: vb.variantId, quantity: 500_000, unitPrice: 0.1 },
    ]);
    // 00h10 em Brasília de amanhã: ainda não é hoje (fora de today, month, last7Days e top).
    await createSale("COMPLETED", new Date(`${addDays(1)}T00:10:00-03:00`), [
      { variantId: vc.variantId, quantity: 7, unitPrice: 3 },
    ]);
    // ontem ao meio-dia
    await createSale("COMPLETED", new Date(`${yesterday}T12:00:00-03:00`), [
      { variantId: vb.variantId, quantity: 2, unitPrice: 10 },
    ]);
    // cancelada hoje: não conta
    await createSale("CANCELED", new Date(`${TODAY}T10:00:00-03:00`), [
      { variantId: vb.variantId, quantity: 9_000_000, unitPrice: 5 },
    ]);

    const after = await readWindow();
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

    // Janela isolada: só as variantes deste teste têm vendas no mês de 2099.
    const top = after.sales.topVariants;
    assert.equal(top[0].productVariantId, va.variantId);
    assert.equal(top[0].quantity, 1_000_000);
    assert.equal(top[0].total, 1_100_000);
    assert.match(top[0].label, / — /);
    assert.equal(top[1].productVariantId, vb.variantId);
    assert.equal(top[1].quantity, 500_000 + (yesterdayInMonth ? 2 : 0));
    assert.equal(top[1].total, round2(50_000 + (yesterdayInMonth ? 20 : 0)));
    assert.ok(!top.some((t: Dash) => t.productVariantId === vc.variantId), "venda de amanhã fora do top");
  });

  test("last7Days: sempre 7 datas consecutivas terminando hoje, com 0 onde não há venda", async () => {
    const data = await readWindow();
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
      await isolated(async () => {
        const before = await readWindow();
        await createDoc(type, "OPEN", [
          { amount: 100, dueDate: addDays(-1), paid: 30 }, // restante 70, vencida
          { amount: 40, dueDate: addDays(-1), paid: 40 }, // paga: não conta
          { amount: 50, dueDate: addDays(3) }, // restante 50, próximos 7 dias
          { amount: 10, dueDate: TODAY }, // hoje: próximos 7, não vencida
          { amount: 30, dueDate: addDays(8) }, // fora dos 7 dias
          { amount: 200, dueDate: addDays(10), reversedPaid: 20 }, // pagamento estornado não abate
        ]);
        await createDoc(type, "CANCELED", [{ amount: 999, dueDate: addDays(-1) }]);
        const after = await readWindow();
        const b = before[key];
        const a = after[key];
        assert.equal(round2(a.open - b.open), 70 + 50 + 10 + 30 + 200);
        assert.equal(round2(a.overdue - b.overdue), 70);
        assert.equal(a.dueNext7Days.count - b.dueNext7Days.count, 2);
        assert.equal(round2(a.dueNext7Days.amount - b.dueNext7Days.amount), 60);
      });
    });

    test(`${key}: documento quitado não soma; parcial com pagamento estornado soma só o restante`, async () => {
      await isolated(async () => {
        const before = await readWindow();
        // Quitado (PAID): restante 0 em todas as parcelas, inclusive vencidas e nos próximos 7 dias.
        await createDoc(type, "PAID", [
          { amount: 80, dueDate: addDays(-2), paid: 80 },
          { amount: 25, dueDate: addDays(2), paid: 25 },
        ]);
        // Parcial: pagamento ativo abate, o estornado não.
        await createDoc(type, "PARTIALLY_PAID", [
          { amount: 100, dueDate: addDays(-3), paid: 10, reversedPaid: 50 }, // restante 90, vencida
          { amount: 40, dueDate: addDays(1), reversedPaid: 40 }, // restante 40, próximos 7 dias
          { amount: 15, dueDate: addDays(5), paid: 15 }, // quitada
        ]);
        const after = await readWindow();
        const b = before[key];
        const a = after[key];
        assert.equal(round2(a.open - b.open), 130);
        assert.equal(round2(a.overdue - b.overdue), 90);
        assert.equal(a.dueNext7Days.count - b.dueNext7Days.count, 1);
        assert.equal(round2(a.dueNext7Days.amount - b.dueNext7Days.amount), 40);
      });
    });
  }

  test("estoque: variante zerada entra; lote vencendo em 30 dias entra, vencido/fora do prazo/zerado não", async () => {
    const [v0, v1, v2, v3] = variants;
    await isolated(async () => {
    const before = await readWindow();

    const mkInv = (variantId: string, quantity: number) =>
      getDb().inventory.create({ data: { productVariantId: variantId, quantity } });
    const mkLot = (inventoryId: string, variantId: string, batch: string, remaining: number, expiry: string) =>
      getDb().inventoryLot.create({
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

    const inv0 = await mkInv(v0.variantId, 0); // zerado: entra (o CHECK do banco impede negativo)
    await mkInv(v1.variantId, 5); // com estoque: não entra
    const inv2 = await mkInv(v2.variantId, 20);
    const inv3 = await mkInv(v3.variantId, 20);
    const inWindow = await mkLot(inv2.id, v2.variantId, "tx-in", 4, TODAY);
    await mkLot(inv2.id, v2.variantId, "tx-edge", 4, addDays(30)); // limite: entra
    await mkLot(inv2.id, v2.variantId, "tx-expired", 4, addDays(-1)); // vencido
    await mkLot(inv2.id, v2.variantId, "tx-far", 4, addDays(31)); // fora do prazo
    await mkLot(inv3.id, v3.variantId, "tx-empty", 0, addDays(5)); // zerado

    const after = await readWindow();
    assert.equal(after.inventory.outOfStockCount - before.inventory.outOfStockCount, 1);
    assert.ok(after.inventory.outOfStock.length <= 10);
    const out = after.inventory.outOfStock.find((i: any) => i.productVariantId === v0.variantId);
    assert.ok(out, "variante zerada na lista");
    assert.equal(out.quantity, 0);
    assert.match(out.label, / — /);
    assert.ok(!after.inventory.outOfStock.some((i: any) => i.productVariantId === v1.variantId));

    assert.equal(after.inventory.expiringLots.count - before.inventory.expiringLots.count, 2);
    assert.deepEqual(
      after.inventory.expiringLots.items.map((i: Dash) => i.batchNumber),
      ["tx-in", "tx-edge"],
    );
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
  });

  test("compras aguardando recebimento: PENDING e PARTIALLY_RECEIVED", async () => {
    await isolated(async () => {
      const before = await readWindow();
      const mk = async (status: "PENDING" | "PARTIALLY_RECEIVED" | "RECEIVED" | "CANCELED", total: number) => {
        await getDb().purchase.create({
          data: {
            code: `tx-${randomUUID()}`,
            supplierId,
            status,
            origin: "MANUAL",
            purchaseDate: asDate(TODAY),
            totalAmount: total,
          },
        });
      };
      await mk("PENDING", 100.5);
      await mk("PARTIALLY_RECEIVED", 20.25);
      await mk("RECEIVED", 999);
      await mk("CANCELED", 5);
      const after = await readWindow();
      assert.equal(after.purchases.awaitingReceipt.count - before.purchases.awaitingReceipt.count, 2);
      assert.equal(round2(after.purchases.awaitingReceipt.total - before.purchases.awaitingReceipt.total), 120.75);
    });
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
      "pricing",
      "profit",
      "purchases",
      "receivables",
      "sales",
    ]);
  });

  test("pricing.pendingReviews: só ADMIN (catalog.price); igual a GET /pricing/reviews/count", async () => {
    assert.ok(!("pricing" in (await read(vendedor))), "VENDEDOR não recebe pricing");
    assert.ok(!("pricing" in (await read(estoquista))), "ESTOQUISTA não recebe pricing");
    const a = await read(admin);
    assert.deepEqual(Object.keys(a.pricing), ["pendingReviews"]);
    const res = await app.inject({
      method: "GET",
      url: "/pricing/reviews/count",
      headers: { authorization: `Bearer ${admin.token}` },
    });
    assert.equal(res.statusCode, 200, res.body);
    assert.equal(typeof a.pricing.pendingReviews, "number");
    // Outras suítes podem criar revisões em paralelo; a leitura seguinte não pode ser menor que zero nem destoar por muito.
    assert.ok(Number.isInteger(a.pricing.pendingReviews) && a.pricing.pendingReviews >= 0);
  });

  test("lucro do mês: só ADMIN recebe a chave; custo registrado, despesas atuais; cancelada não conta", async () => {
    const v = await read(vendedor);
    assert.ok(!("profit" in v), "VENDEDOR não recebe profit");
    assert.ok(!("profit" in (await read(estoquista))));

    const bps = (await new PrismaPricingSettingsReader().get()).expensesBps;
    const before = await readWindow();
    await createSale("COMPLETED", new Date(`${TODAY}T12:00:00-03:00`), [
      { variantId: variants[0].variantId, quantity: 2, unitPrice: 10, unitCost: 3 },
    ]);
    await createSale("CANCELED", new Date(`${TODAY}T12:00:00-03:00`), [
      { variantId: variants[0].variantId, quantity: 9, unitPrice: 10, unitCost: 1 },
    ]);
    const after = await readWindow();
    assert.deepEqual(Object.keys(after.profit.month).sort(), ["marginPercent", "profit", "revenue"]);
    assert.equal(round2(after.profit.month.revenue - before.profit.month.revenue), 20);
    const afterBps = (await new PrismaPricingSettingsReader().get()).expensesBps;
    if (bps === afterBps) {
      // O mês soma os dias: só o dia de hoje mudou (receita 20,00, custo 6,00).
      const expenses = (total: number) => applyBps(Math.round(total * 100), bps) / 100;
      const todayBefore = before.sales.last7Days[6].total;
      const todayAfter = after.sales.last7Days[6].total;
      assert.equal(
        round2(after.profit.month.profit - before.profit.month.profit),
        round2(20 - 6 - (expenses(todayAfter) - expenses(todayBefore))),
      );
    }
    if (after.profit.month.revenue > 0) {
      assert.equal(
        after.profit.month.marginPercent,
        Math.round((after.profit.month.profit / after.profit.month.revenue) * 10_000) / 100,
      );
    }
  });

  test("chaves = fixture", async () => {
    // Listas não vazias: cria um estoque zerado e um lote vencendo (desfeitos no fim).
    await isolated(async () => {
      const inventory = await getDb().inventory.create({ data: { productVariantId: variants[0].variantId, quantity: 0 } });
      await getDb().inventoryLot.create({
        data: {
          inventoryId: inventory.id,
          productVariantId: variants[0].variantId,
          sourceType: "MANUAL",
          initialQuantity: 5,
          remainingQuantity: 5,
          unitCost: 1,
          batchNumber: "tx-keys",
          expirationDate: asDate(addDays(3)),
        },
      });
      const data = await readWindow();
      const fixture = JSON.parse(readFileSync(FIXTURE, "utf8"));
      assert.deepEqual(keyShape(data), keyShape(fixture.data));
    });
  });
});
