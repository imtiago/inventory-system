import "dotenv/config";
import { after, afterEach, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { prisma } from "@shared/prisma";
import { todayInBusinessTz } from "@shared/domain/businessDate";
import { deleteFinancialDocuments } from "../../../../../test/cleanup";
import { app } from "../../../../../app";
import { keyShape } from "../../../../../test/keyShape";
import { createTestVariant } from "../../../../../test/inventoryFixtures";
import { createTestUser, TestUser } from "../../../../../test/authFixtures";
import { newIdempotencyKey, withIdempotencyKey } from "../../../../../test/idempotency";
import { acquirePricingTestLock } from "../../../../../test/pricingTestLock";
import { convertToLegacyInstallments } from "../../../../../test/legacySaleFixtures";

app.log.level = "silent";

const FIXTURES_DIR = new URL("../../../../../../../frontend/src/test/fixtures/sales/", import.meta.url);
const loadFixture = (name: string): unknown => JSON.parse(readFileSync(new URL(`${name}.json`, FIXTURES_DIR), "utf8"));

const DAY_MS = 24 * 60 * 60 * 1000;

const creditFees = (overrides: Record<number, number> = {}) =>
  Object.fromEntries(Array.from({ length: 12 }, (_, i) => [String(i + 1), overrides[i + 1] ?? 300 + i * 50]));

describe("fechamento da venda: dinheiro, PIX, débito e crédito", () => {
  let admin: TestUser;
  let seller: TestUser;
  let customerId: string;
  let releasePricingLock: () => Promise<void>;
  const variants: { id: string; cleanup: () => Promise<void> }[] = [];

  const call = (user: TestUser, method: "GET" | "POST", url: string, payload?: unknown, key?: string) =>
    app.inject({
      method,
      url,
      payload: payload as any,
      headers: key
        ? { authorization: `Bearer ${user.token}`, "idempotency-key": key }
        : withIdempotencyKey(method, { authorization: `Bearer ${user.token}` }),
    });

  /** Variante com preço e 10 unidades a custo 5,00. */
  const createVariant = async (salePrice: number) => {
    const { variantId, cleanup } = await createTestVariant();
    variants.push({ id: variantId, cleanup });
    await prisma.productVariant.update({ where: { id: variantId }, data: { salePrice } });
    const res = await call(admin, "POST", "/inventory/lots", {
      productVariantId: variantId,
      batchNumber: `tx-test-${randomUUID().slice(0, 8)}`,
      quantity: 10,
      unitCost: 5,
      expirationDate: "2030-06-30T00:00:00.000Z",
    });
    assert.equal(res.statusCode, 200, res.body);
    return variantId;
  };

  const configureFees = async () => {
    await prisma.pricingExpense.deleteMany({});
    await prisma.pricingSettings.deleteMany({});
    await prisma.pricingSettings.create({
      data: { id: "default", defaultMarginBps: 3000, cardFees: { debitBps: 199, creditBps: creditFees({ 3: 499 }) } },
    });
  };

  const sell = (user: TestUser, variantId: string, payment: unknown, quantity = 1, key?: string) =>
    call(user, "POST", "/sales", { customerId, items: [{ productVariantId: variantId, quantity }], payment }, key);

  const qty = async (variantId: string) =>
    (await prisma.inventory.findUniqueOrThrow({ where: { productVariantId: variantId } })).quantity;

  const checkoutPayments = (saleId: string) =>
    prisma.payment.findMany({ where: { parcel: { document: { originType: "SALE", originId: saleId } } } });

  const ageSale = (saleId: string, days: number) =>
    prisma.sale.update({ where: { id: saleId }, data: { createdAt: new Date(Date.now() - days * DAY_MS) } });

  before(async () => {
    releasePricingLock = await acquirePricingTestLock();
  });

  beforeEach(async () => {
    admin = await createTestUser({ role: "ADMIN" });
    seller = await createTestUser({ role: "VENDEDOR" });
    const tag = `tx-test-${randomUUID()}`;
    customerId = (await prisma.customer.create({ data: { name: tag, code: tag } })).id;
    await configureFees();
  });

  afterEach(async () => {
    const id = customerId;
    const toClean = variants.splice(0);
    try {
      try {
        await deleteFinancialDocuments({ where: { partyId: id } });
      } finally {
        const sales = await prisma.sale.findMany({ where: { customerId: id }, select: { id: true } });
        await prisma.saleCancelRequest.deleteMany({ where: { saleId: { in: sales.map((s) => s.id) } } });
        await prisma.sale.deleteMany({ where: { customerId: id } });
      }
    } finally {
      try {
        for (const v of toClean) await v.cleanup();
      } finally {
        try {
          await prisma.customer.deleteMany({ where: { id } });
        } finally {
          await admin.cleanup();
          await seller.cleanup();
        }
      }
    }
  });

  after(async () => {
    try {
      await prisma.pricingExpense.deleteMany({});
      await prisma.pricingSettings.deleteMany({});
    } finally {
      await releasePricingLock?.();
      await app.close();
      await prisma.$disconnect();
    }
  });

  test("CASH: venda + contas a receber PAID com pagamento CASH atCheckout; resposta igual à de hoje + paymentCondition", async () => {
    const variantId = await createVariant(10);
    const res = await sell(seller, variantId, { condition: "CASH" }, 2);
    assert.equal(res.statusCode, 201, res.body);
    const body = res.json();
    const dto = body.data;
    assert.equal(dto.paymentCondition, "CASH");
    assert.equal(dto.totalAmount, 20);
    assert.equal(dto.surchargeAmount, 0);
    assert.equal(dto.cardFeePassedOn, false);
    assert.equal(dto.cardInstallments, null);
    assert.equal(dto.downPayment, 0);
    assert.equal(dto.receivable.status, "PAID");
    assert.equal(dto.receivable.parcels.length, 1);
    assert.equal(dto.receivable.parcels[0].dueDate, todayInBusinessTz());
    assert.equal(dto.receivable.parcels[0].paidAmount, 20);
    assert.equal(dto.receivable.parcels[0].status, "PAID");
    assert.deepEqual(keyShape(body), keyShape(loadFixture("saleDetail")), "POST /sales difere de saleDetail.json");

    const payments = await checkoutPayments(dto.id);
    assert.equal(payments.length, 1);
    assert.equal(payments[0].method, "CASH");
    assert.equal(payments[0].atCheckout, true);
    assert.equal(Number(payments[0].amount), 20);
    assert.equal(payments[0].createdById, seller.id);
    assert.equal(payments[0].paymentDate.toISOString().slice(0, 10), todayInBusinessTz());

    const sale = await prisma.sale.findUniqueOrThrow({ where: { id: dto.id } });
    assert.equal(sale.paymentCondition, "CASH");
    assert.equal(sale.cardFeeBps, null);
    assert.equal(await qty(variantId), 8);

    const pix = await sell(seller, variantId, { condition: "PIX" });
    assert.equal(pix.statusCode, 201, pix.body);
    assert.equal(pix.json().data.paymentCondition, "PIX");
    assert.equal((await checkoutPayments(pix.json().data.id))[0].method, "PIX");
  });

  test("CREDIT_CARD 3x com repasse, taxa 4,99%, itens 100,00 → total 105,26, surcharge 5,26, cardFeeBps 499; pagamento 105,26 CREDIT_CARD", async () => {
    const variantId = await createVariant(100);
    const res = await sell(seller, variantId, { condition: "CREDIT_CARD", cardInstallments: 3 });
    assert.equal(res.statusCode, 201, res.body);
    const dto = res.json().data;
    assert.equal(dto.paymentCondition, "CREDIT_CARD");
    assert.equal(dto.totalAmount, 105.26);
    assert.equal(dto.surchargeAmount, 5.26);
    assert.equal(dto.cardFeePassedOn, true);
    assert.equal(dto.cardInstallments, 3);
    assert.equal(dto.receivable.status, "PAID");
    assert.equal(dto.items[0].totalPrice, 100);

    const sale = await prisma.sale.findUniqueOrThrow({ where: { id: dto.id } });
    assert.equal(sale.cardFeeBps, 499);
    assert.equal(Number(sale.surchargeAmount), 5.26);
    assert.equal(Number(sale.totalAmount), 105.26);
    const [payment] = await checkoutPayments(dto.id);
    assert.equal(payment.method, "CREDIT_CARD");
    assert.equal(Number(payment.amount), 105.26);
    assert.equal(payment.atCheckout, true);
  });

  test("DEBIT_CARD sem repasse → total = itens; cardFeePassedOn false", async () => {
    const variantId = await createVariant(100);
    const res = await sell(seller, variantId, { condition: "DEBIT_CARD", passCardFee: false });
    assert.equal(res.statusCode, 201, res.body);
    const dto = res.json().data;
    assert.equal(dto.totalAmount, 100);
    assert.equal(dto.surchargeAmount, 0);
    assert.equal(dto.cardFeePassedOn, false);
    assert.equal(dto.cardInstallments, null);
    const sale = await prisma.sale.findUniqueOrThrow({ where: { id: dto.id } });
    assert.equal(sale.cardFeeBps, 199);
    assert.equal(sale.cardFeePassedOn, false);
    const [payment] = await checkoutPayments(dto.id);
    assert.equal(payment.method, "DEBIT_CARD");
    assert.equal(Number(payment.amount), 100);

    // Débito com repasse (padrão): 100,00 ÷ (1 − 1,99%) = 102,04 (centavo para cima).
    const passed = await sell(seller, variantId, { condition: "DEBIT_CARD" });
    assert.equal(passed.statusCode, 201, passed.body);
    assert.equal(passed.json().data.totalAmount, 102.04);
    assert.equal(passed.json().data.cardFeePassedOn, true);
  });

  test("precificação não configurada → taxa 0, total = itens", async () => {
    await prisma.pricingSettings.deleteMany({});
    const variantId = await createVariant(100);
    const res = await sell(seller, variantId, { condition: "CREDIT_CARD", cardInstallments: 3 });
    assert.equal(res.statusCode, 201, res.body);
    const dto = res.json().data;
    assert.equal(dto.totalAmount, 100);
    assert.equal(dto.surchargeAmount, 0);
    const sale = await prisma.sale.findUniqueOrThrow({ where: { id: dto.id } });
    assert.equal(sale.cardFeeBps, 0);
  });

  test("validação do pagamento: cartão de crédito exige parcelas 1..12; parcelas só no crédito", async () => {
    const variantId = await createVariant(10);
    for (const payment of [
      { condition: "CREDIT_CARD" },
      { condition: "CREDIT_CARD", cardInstallments: 13 },
      { condition: "CREDIT_CARD", cardInstallments: 0 },
      { condition: "CASH", cardInstallments: 2 },
      { condition: "BOLETO" },
      { condition: "CASH", crediario: { installments: 2, downPayment: 0 } },
    ]) {
      const res = await sell(seller, variantId, payment);
      assert.equal(res.statusCode, 400, `${JSON.stringify(payment)} → ${res.body}`);
    }
    // Crediário (ligado/desligado é global): checkoutCrediario.test.ts, sob acquireCreditTestLock().
    assert.equal(await qty(variantId), 10);
  });

  test("simulate: ADMIN recebe margin; VENDEDOR não recebe a chave", async () => {
    const variantId = await createVariant(100);
    const payload = { customerId, items: [{ productVariantId: variantId, quantity: 1 }] };

    const adminRes = await call(admin, "POST", "/sales/simulate", payload);
    assert.equal(adminRes.statusCode, 200, adminRes.body);
    const sim = adminRes.json().data;
    assert.equal(sim.itemsTotal, 100);
    const find = (condition: string, cardInstallments: number | null, passCardFee: boolean) =>
      sim.conditions.find(
        (c: { condition: string; cardInstallments: number | null; passCardFee: boolean }) =>
          c.condition === condition && c.cardInstallments === cardInstallments && c.passCardFee === passCardFee,
      );
    assert.deepEqual(find("CASH", null, false), { condition: "CASH", cardInstallments: null, passCardFee: false, total: 100, margin: { amount: 95, percent: 95 } });
    assert.equal(find("PIX", null, false).total, 100);
    assert.equal(find("DEBIT_CARD", null, true).total, 102.04);
    assert.equal(find("DEBIT_CARD", null, false).total, 100);
    assert.equal(find("CREDIT_CARD", 3, true).total, 105.26);
    assert.equal(find("CREDIT_CARD", 3, false).total, 100);
    // Sem repasse a loja absorve 4,99%: 100,00 − 4,99 − 5,00 de custo = 90,01.
    assert.deepEqual(find("CREDIT_CARD", 3, false).margin, { amount: 90.01, percent: 90.01 });
    for (let n = 1; n <= 12; n++) assert.ok(find("CREDIT_CARD", n, true), `crédito ${n}x`);
    assert.ok(sim.conditions.every((c: object) => "margin" in c));
    assert.ok(!sim.conditions.some((c: { condition: string }) => c.condition === "CREDIARIO"));

    const sellerRes = await call(seller, "POST", "/sales/simulate", payload);
    assert.equal(sellerRes.statusCode, 200, sellerRes.body);
    const sellerSim = sellerRes.json().data;
    assert.equal(sellerSim.conditions.length, sim.conditions.length);
    assert.ok(sellerSim.conditions.every((c: object) => !("margin" in c)), sellerRes.body);
    assert.ok(!sellerRes.body.includes("margin"));
    assert.deepEqual(keyShape(adminRes.json()), keyShape(loadFixture("saleSimulation")), "difere de saleSimulation.json");

    // Simular não baixa estoque nem grava venda.
    assert.equal(await qty(variantId), 10);
    assert.equal(await prisma.sale.count({ where: { customerId } }), 0);

    const missing = await call(seller, "POST", "/sales/simulate", { ...payload, customerId: randomUUID() });
    assert.equal(missing.statusCode, 404, missing.body);
    const invalid = await call(seller, "POST", "/sales/simulate", { customerId, items: [] });
    assert.equal(invalid.statusCode, 400, invalid.body);
  });

  test("cancelar venda à vista → pagamento atCheckout estornado, venda CANCELED, estoque devolvido", async () => {
    const variantId = await createVariant(10);
    const created = await sell(seller, variantId, { condition: "PIX" }, 3);
    assert.equal(created.statusCode, 201, created.body);
    const saleId = created.json().data.id;
    assert.equal(await qty(variantId), 7);

    const res = await call(admin, "POST", `/sales/${saleId}/cancel`);
    assert.equal(res.statusCode, 200, res.body);
    assert.equal(res.json().data.status, "CANCELED");
    assert.equal(res.json().data.receivable.status, "CANCELED");
    assert.equal(await qty(variantId), 10);

    const [payment] = await checkoutPayments(saleId);
    assert.ok(payment.reversedAt, "pagamento estornado");
    assert.equal(payment.reversalReason, "Venda cancelada");
    assert.equal(payment.reversedById, admin.id);
  });

  test("cancelar venda à vista no 7º dia → ok; no 8º dia → 409 CHECKOUT_REFUND_WINDOW_EXPIRED", async () => {
    const variantId = await createVariant(10);
    const day7 = (await sell(seller, variantId, { condition: "CASH" })).json().data.id;
    const day8 = (await sell(seller, variantId, { condition: "CREDIT_CARD", cardInstallments: 2 })).json().data.id;
    await ageSale(day7, 7);
    await ageSale(day8, 8);

    // Pedido do vendedor no 8º dia já é recusado.
    const request = await call(seller, "POST", `/sales/${day8}/cancel-requests`, { reason: "Cliente desistiu" });
    assert.equal(request.statusCode, 409, request.body);
    assert.equal(request.json().code, "CHECKOUT_REFUND_WINDOW_EXPIRED");

    const late = await call(admin, "POST", `/sales/${day8}/cancel`);
    assert.equal(late.statusCode, 409, late.body);
    assert.equal(late.json().code, "CHECKOUT_REFUND_WINDOW_EXPIRED");
    assert.equal(late.json().message, "Venda paga no ato só pode ser cancelada com estorno em até 7 dias.");
    assert.equal((await prisma.sale.findUniqueOrThrow({ where: { id: day8 } })).status, "COMPLETED");
    assert.equal((await checkoutPayments(day8))[0].reversedAt, null);
    assert.equal(await qty(variantId), 8);

    // 7º dia: pedido do vendedor → aprovação do ADMIN estorna e cancela.
    const ok = await call(seller, "POST", `/sales/${day7}/cancel-requests`, { reason: "Cliente desistiu" });
    assert.equal(ok.statusCode, 201, ok.body);
    const approved = await call(admin, "POST", `/sales/cancel-requests/${ok.json().data.id}/approve`);
    assert.equal(approved.statusCode, 200, approved.body);
    assert.equal((await prisma.sale.findUniqueOrThrow({ where: { id: day7 } })).status, "CANCELED");
    assert.ok((await checkoutPayments(day7))[0].reversedAt);
    assert.equal(await qty(variantId), 9);
  });

  test("pagamento de parcela (não atCheckout) continua bloqueando o cancelamento", async () => {
    const variantId = await createVariant(10);
    const created = await call(seller, "POST", "/sales", {
      customerId,
      items: [{ productVariantId: variantId, quantity: 1 }],
      payment: { condition: "CASH" },
    });
    assert.equal(created.statusCode, 201, created.body);
    const dto = created.json().data;
    // Parcela em aberto (venda parcelada antiga); o pagamento dela não é atCheckout.
    const legacy = await convertToLegacyInstallments(dto.id);
    const paid = await call(admin, "POST", `/receivables/${legacy.documentId}/parcels/${legacy.parcelIds[0]}/payments`, {
      amount: 10,
      method: "CASH",
    });
    assert.equal(paid.statusCode, 201, paid.body);
    const res = await call(admin, "POST", `/sales/${dto.id}/cancel`);
    assert.equal(res.statusCode, 409, res.body);
    assert.equal(res.json().code, "SALE_HAS_PAYMENTS");
  });

  test("idempotência: mesma chave → um só pagamento; replay com Idempotent-Replayed", async () => {
    const variantId = await createVariant(10);
    const key = newIdempotencyKey();
    const first = await sell(seller, variantId, { condition: "CASH" }, 1, key);
    assert.equal(first.statusCode, 201, first.body);
    const second = await sell(seller, variantId, { condition: "CASH" }, 1, key);
    assert.equal(second.statusCode, 201, second.body);
    assert.equal(second.headers["idempotent-replayed"], "true");
    assert.equal(second.json().data.id, first.json().data.id);
    assert.equal(await prisma.sale.count({ where: { customerId } }), 1);
    assert.equal(await prisma.payment.count({ where: { parcel: { document: { partyId: customerId } } } }), 1);
    assert.equal(await qty(variantId), 9);
  });
});
