import "dotenv/config";
import { after, afterEach, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "@shared/prisma";
import { todayInBusinessTz } from "@shared/domain/businessDate";
import { deleteFinancialDocuments } from "../../../../../test/cleanup";
import { app } from "../../../../../app";
import { getTestUserId } from "../../../../../test/inventoryFixtures";
import { createTestUser, signTestToken, type TestUser } from "../../../../../test/authFixtures";
import { withIdempotencyKey } from "../../../../../test/idempotency";
import { acquireCreditTestLock } from "../../../../../test/creditTestLock";
import { resetCreditDefaults } from "../../../../../test/creditFixtures";
import { randomCpf } from "../../../../../test/documentFixtures";
import { keyShape } from "../../../../../test/keyShape";
import { readFileSync } from "node:fs";

const FIXTURE = new URL("../../../../../../../frontend/src/test/fixtures/finance/lateFeeQuote.json", import.meta.url);

app.log.level = "silent";

const TODAY = todayInBusinessTz();
const addDays = (days: number) => {
  const d = new Date(`${TODAY}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/**
 * Encargos de atraso (multa 2% uma vez por parcela, juros 1% a.m. pró-rata desde o vencimento,
 * carência 3 dias) cobrados no recebimento. Valores iniciais das configurações de crédito: segura o
 * lock dos testes de crédito (outro arquivo pode mudar carência/multa/juros).
 */
describe("Multa, juros e dispensa no recebimento", () => {
  let release: () => Promise<void>;
  let adminToken: string;
  let customerId: string;
  let supplierId: string;
  const users: TestUser[] = [];

  const request = (method: "GET" | "POST", url: string, token: string, payload?: unknown) =>
    app.inject({ method, url, payload: payload as never, headers: withIdempotencyKey(method, { authorization: `Bearer ${token}` }) });

  /** Documento com uma parcela vencida em `dueDate` (criado há 90 dias para aceitar pagamentos retroativos). */
  const createDocument = async (opts: {
    amount: number;
    dueDate: string;
    noLateFees?: boolean;
    type?: "RECEIVABLE" | "PAYABLE";
  }) => {
    const type = opts.type ?? "RECEIVABLE";
    const doc = await prisma.financialDocument.create({
      data: {
        type,
        originType: type === "RECEIVABLE" ? "SALE" : "PURCHASE",
        originId: randomUUID(),
        partyType: type === "RECEIVABLE" ? "CUSTOMER" : "SUPPLIER",
        partyId: type === "RECEIVABLE" ? customerId : supplierId,
        noLateFees: opts.noLateFees ?? false,
        createdAt: new Date(`${addDays(-90)}T12:00:00.000Z`),
        parcels: { create: [{ amount: opts.amount, dueDate: new Date(`${opts.dueDate}T00:00:00.000Z`) }] },
      },
      include: { parcels: true },
    });
    return { documentId: doc.id, parcelId: doc.parcels[0].id };
  };

  const pay = (documentId: string, parcelId: string, body: Record<string, unknown>, token = adminToken) =>
    request("POST", `/receivables/${documentId}/parcels/${parcelId}/payments`, token, { method: "CASH", ...body });
  const quote = (documentId: string, parcelId: string, paymentDate?: string, token = adminToken) =>
    request(
      "GET",
      `/receivables/${documentId}/parcels/${parcelId}/late-fees${paymentDate ? `?paymentDate=${paymentDate}` : ""}`,
      token,
    );

  before(async () => {
    release = await acquireCreditTestLock();
    await resetCreditDefaults();
  });

  beforeEach(async () => {
    adminToken = signTestToken(await getTestUserId());
    const tag = `tx-test-${randomUUID()}`;
    customerId = (await prisma.customer.create({ data: { name: tag, code: tag } })).id;
    supplierId = (await prisma.supplier.create({ data: { name: tag, document: randomCpf() } })).id;
  });

  afterEach(async () => {
    try {
      await deleteFinancialDocuments({ where: { partyId: { in: [customerId, supplierId] } } });
    } finally {
      await prisma.customer.deleteMany({ where: { id: customerId } });
      await prisma.supplier.deleteMany({ where: { id: supplierId } });
      for (const u of users.splice(0)) await u.cleanup();
    }
  });

  after(async () => {
    try {
      await release();
    } finally {
      try {
        await app.close();
      } finally {
        await prisma.$disconnect();
      }
    }
  });

  test("parcela 100,00 vencida há 10 dias, pagamento hoje de 100,00 → multa 2,00, juros 0,33; documento PAID", async () => {
    const { documentId, parcelId } = await createDocument({ amount: 100, dueDate: addDays(-10) });

    const q = await quote(documentId, parcelId, TODAY);
    assert.equal(q.statusCode, 200, q.body);
    assert.deepEqual(q.json().data, { principalRemaining: 100, daysLate: 10, fine: 2, interest: 0.33, totalDue: 102.33 });
    assert.deepEqual(keyShape(q.json()), keyShape(JSON.parse(readFileSync(FIXTURE, "utf8"))));

    const res = await pay(documentId, parcelId, { amount: 100, paymentDate: TODAY });
    assert.equal(res.statusCode, 201, res.body);
    const d = res.json().data;
    assert.equal(d.status, "PAID");
    const [p] = d.parcels[0].payments;
    assert.equal(p.amount, 100);
    assert.equal(p.fineAmount, 2);
    assert.equal(p.interestAmount, 0.33);
    assert.equal(p.waivedAmount, 0);
    assert.equal(p.receivedAmount, 102.33);

    const row = await prisma.payment.findFirstOrThrow({ where: { parcelId } });
    assert.equal(Number(row.fineAmount), 2);
    assert.equal(Number(row.interestAmount), 0.33);
  });

  test("pagamento no 3º dia após o vencimento (carência) → encargos 0", async () => {
    const { documentId, parcelId } = await createDocument({ amount: 100, dueDate: addDays(-3) });
    const q = await quote(documentId, parcelId);
    assert.equal(q.statusCode, 200, q.body);
    assert.deepEqual(q.json().data, { principalRemaining: 100, daysLate: 3, fine: 0, interest: 0, totalDue: 100 });

    const res = await pay(documentId, parcelId, { amount: 40 });
    assert.equal(res.statusCode, 201, res.body);
    const [p] = res.json().data.parcels[0].payments;
    assert.equal(p.fineAmount, 0);
    assert.equal(p.interestAmount, 0);
    assert.equal(p.receivedAmount, 40);
  });

  test("detalhe traz lateFeesToday da parcela e noLateFees do documento", async () => {
    const { documentId } = await createDocument({ amount: 100, dueDate: addDays(-10) });
    const res = await request("GET", `/receivables/${documentId}`, adminToken);
    assert.equal(res.statusCode, 200, res.body);
    const d = res.json().data;
    assert.equal(d.noLateFees, false);
    assert.deepEqual(d.parcels[0].lateFeesToday, { daysLate: 10, fine: 2, interest: 0.33, totalDue: 102.33 });
  });

  test("dispensa total por VENDEDOR marcado → waived 2,33 e motivo; sem marca → 403", async () => {
    const flagged = await createTestUser({ role: "VENDEDOR", canApproveCredit: true });
    const plain = await createTestUser({ role: "VENDEDOR" });
    users.push(flagged, plain);
    const { documentId, parcelId } = await createDocument({ amount: 100, dueDate: addDays(-10) });

    const denied = await pay(documentId, parcelId, { amount: 100, waiveAmount: 2.33, waiverReason: "Cliente antigo" }, plain.token);
    assert.equal(denied.statusCode, 403, denied.body);
    assert.equal(denied.json().code, "LATE_FEE_WAIVER_FORBIDDEN");
    assert.equal(await prisma.payment.count({ where: { parcelId } }), 0);

    const noReason = await pay(documentId, parcelId, { amount: 100, waiveAmount: 2.33 }, flagged.token);
    assert.equal(noReason.statusCode, 400, noReason.body);

    const tooMuch = await pay(documentId, parcelId, { amount: 100, waiveAmount: 2.34, waiverReason: "Cliente antigo" }, flagged.token);
    assert.equal(tooMuch.statusCode, 422, tooMuch.body);
    assert.equal(tooMuch.json().code, "WAIVER_EXCEEDS_FEES");

    const ok = await pay(documentId, parcelId, { amount: 100, waiveAmount: 2.33, waiverReason: "  Cliente antigo  " }, flagged.token);
    assert.equal(ok.statusCode, 201, ok.body);
    const [p] = ok.json().data.parcels[0].payments;
    assert.equal(p.fineAmount, 2);
    assert.equal(p.interestAmount, 0.33);
    assert.equal(p.waivedAmount, 2.33);
    assert.equal(p.waiverReason, "Cliente antigo");
    assert.equal(p.waivedBy.id, flagged.id);
    assert.equal(p.receivedAmount, 100);
  });

  test("documento noLateFees (venda antiga) → nunca cobra; dispensa → 422", async () => {
    const { documentId, parcelId } = await createDocument({ amount: 100, dueDate: addDays(-40), noLateFees: true });
    const q = await quote(documentId, parcelId);
    assert.equal(q.statusCode, 200, q.body);
    assert.deepEqual(q.json().data, { principalRemaining: 100, daysLate: 40, fine: 0, interest: 0, totalDue: 100 });

    const waive = await pay(documentId, parcelId, { amount: 100, waiveAmount: 1, waiverReason: "Teste" });
    assert.equal(waive.statusCode, 422, waive.body);
    assert.equal(waive.json().code, "WAIVER_EXCEEDS_FEES");

    const res = await pay(documentId, parcelId, { amount: 100 });
    assert.equal(res.statusCode, 201, res.body);
    const [p] = res.json().data.parcels[0].payments;
    assert.equal(p.fineAmount, 0);
    assert.equal(p.interestAmount, 0);
    assert.equal(res.json().data.parcels[0].lateFeesToday.fine, 0);
  });

  test("multa uma vez por parcela; juros do 2º pagamento desde o 1º; estorno devolve os encargos", async () => {
    const { documentId, parcelId } = await createDocument({ amount: 100, dueDate: addDays(-20) });

    // 1º pagamento há 10 dias: 10 dias de atraso → multa 2,00 + juros 0,33 sobre 100.
    const first = await pay(documentId, parcelId, { amount: 40, paymentDate: addDays(-10), backdateReason: "Pago na loja, lançado depois" });
    assert.equal(first.statusCode, 201, first.body);
    const p1 = first.json().data.parcels[0].payments[0];
    assert.equal(p1.fineAmount, 2);
    assert.equal(p1.interestAmount, 0.33);

    // Hoje: sem nova multa; juros de 10 dias sobre 60 → 0,20.
    const q = await quote(documentId, parcelId);
    assert.deepEqual(q.json().data, { principalRemaining: 60, daysLate: 20, fine: 0, interest: 0.2, totalDue: 60.2 });

    const rev = await request("POST", `/receivables/payments/${p1.id}/reverse`, adminToken, { reason: "Lançado errado" });
    assert.equal(rev.statusCode, 200, rev.body);

    // Estornado: o próximo pagamento volta a cobrar multa e juros desde o vencimento.
    const again = await quote(documentId, parcelId);
    assert.deepEqual(again.json().data, { principalRemaining: 100, daysLate: 20, fine: 2, interest: 0.67, totalDue: 102.67 });
    const second = await pay(documentId, parcelId, { amount: 100 });
    assert.equal(second.statusCode, 201, second.body);
    const active = second.json().data.parcels[0].payments.find((p: { reversedAt: string | null }) => p.reversedAt === null);
    assert.equal(active.fineAmount, 2);
    assert.equal(active.interestAmount, 0.67);
  });

  test("data passada a receber: sem credit.approve → 403 BACKDATED_PAYMENT_FORBIDDEN; aprovador precisa de motivo; futuro → 400", async () => {
    const flagged = await createTestUser({ role: "VENDEDOR", canApproveCredit: true });
    const plain = await createTestUser({ role: "VENDEDOR" });
    users.push(flagged, plain);
    // Parcela vencida há 20 dias: pagar "no vencimento" zeraria multa e juros.
    const { documentId, parcelId } = await createDocument({ amount: 100, dueDate: addDays(-20) });

    const denied = await pay(documentId, parcelId, { amount: 100, paymentDate: addDays(-20), backdateReason: "Pagou no dia" }, plain.token);
    assert.equal(denied.statusCode, 403, denied.body);
    assert.equal(denied.json().code, "BACKDATED_PAYMENT_FORBIDDEN");
    assert.equal(denied.json().message, "Só quem pode aprovar crédito registra pagamento com data passada.");
    assert.equal(await prisma.payment.count({ where: { parcelId } }), 0);

    const future = await pay(documentId, parcelId, { amount: 100, paymentDate: addDays(1) }, flagged.token);
    assert.equal(future.statusCode, 400, future.body);

    for (const backdateReason of [undefined, "  ", "ab"]) {
      const noReason = await pay(documentId, parcelId, { amount: 100, paymentDate: addDays(-20), backdateReason }, flagged.token);
      assert.equal(noReason.statusCode, 400, noReason.body);
      assert.equal(noReason.json().errors[0].field, "backdateReason");
    }

    // Hoje, sem data ou com a data de hoje: qualquer um com finance.pay; motivo ignorado.
    const todayOk = await pay(documentId, parcelId, { amount: 10, paymentDate: TODAY, backdateReason: "ignorado" }, plain.token);
    assert.equal(todayOk.statusCode, 201, todayOk.body);
    assert.equal(todayOk.json().data.parcels[0].payments[0].backdateReason, null);

    const ok = await pay(documentId, parcelId, { amount: 90, paymentDate: addDays(-20), backdateReason: "  Pagou no vencimento, lançado hoje  " }, flagged.token);
    assert.equal(ok.statusCode, 201, ok.body);
    const back = ok.json().data.parcels[0].payments.find((p: { amount: number }) => p.amount === 90);
    assert.equal(back.paymentDate, addDays(-20));
    assert.equal(back.backdateReason, "Pagou no vencimento, lançado hoje");
    const row = await prisma.payment.findFirstOrThrow({ where: { parcelId, amount: 90 } });
    assert.equal(row.backdateReason, "Pagou no vencimento, lançado hoje");
  });

  test("contas a pagar: data passada continua livre (sem motivo); backdateReason → 400", async () => {
    const { documentId, parcelId } = await createDocument({ amount: 100, dueDate: addDays(-30), type: "PAYABLE" });
    const url = `/payables/${documentId}/parcels/${parcelId}/payments`;
    const bad = await request("POST", url, adminToken, { amount: 10, method: "CASH", paymentDate: addDays(-5), backdateReason: "x y z" });
    assert.equal(bad.statusCode, 400, bad.body);
    const res = await request("POST", url, adminToken, { amount: 10, method: "CASH", paymentDate: addDays(-5) });
    assert.equal(res.statusCode, 201, res.body);
    assert.equal(res.json().data.parcels[0].payments[0].backdateReason, null);
  });

  test("contas a pagar não aceita waiveAmount (400) e não calcula encargos", async () => {
    const { documentId, parcelId } = await createDocument({ amount: 100, dueDate: addDays(-30), type: "PAYABLE" });
    const url = `/payables/${documentId}/parcels/${parcelId}/payments`;

    const bad = await request("POST", url, adminToken, { amount: 100, method: "CASH", waiveAmount: 1, waiverReason: "x y z" });
    assert.equal(bad.statusCode, 400, bad.body);

    const res = await request("POST", url, adminToken, { amount: 100, method: "CASH" });
    assert.equal(res.statusCode, 201, res.body);
    const parcel = res.json().data.parcels[0];
    assert.equal(parcel.lateFeesToday, null);
    assert.equal(parcel.payments[0].fineAmount, 0);
    assert.equal(parcel.payments[0].interestAmount, 0);
    assert.equal(parcel.payments[0].receivedAmount, 100);

    const notFound = await request("GET", `/receivables/${documentId}/parcels/${parcelId}/late-fees`, adminToken);
    assert.equal(notFound.statusCode, 404, notFound.body);
  });

  test("quote: data futura → 400; parcela de outro documento → 404; ESTOQUISTA → 403", async () => {
    const { documentId, parcelId } = await createDocument({ amount: 100, dueDate: addDays(-10) });
    const other = await createDocument({ amount: 50, dueDate: addDays(-10) });

    assert.equal((await quote(documentId, parcelId, addDays(1))).statusCode, 400);
    assert.equal((await quote(documentId, parcelId, "2026-13-01")).statusCode, 400);
    const wrong = await quote(documentId, other.parcelId);
    assert.equal(wrong.statusCode, 404, wrong.body);
    assert.equal(wrong.json().code, "PARCEL_NOT_FOUND");

    const stock = await createTestUser({ role: "ESTOQUISTA" });
    users.push(stock);
    assert.equal((await quote(documentId, parcelId, undefined, stock.token)).statusCode, 403);
  });
});
