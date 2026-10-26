import "dotenv/config";
import { after, afterEach, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "@shared/prisma";
import { deleteFinancialDocuments } from "../../../../../test/cleanup";
import { todayInBusinessTz } from "@shared/domain/businessDate";
import { InternalInvariantError } from "@shared/domain/errors";
import { PrismaFinancialDocumentRepository } from "@finance/infrastructure/prisma/repositories/PrismaFinancialDocumentRepository";
import { app } from "../../../../../app";
import { createTestVariant, getTestUserId } from "../../../../../test/inventoryFixtures";
import { signTestToken } from "../../../../../test/authFixtures";
import { withIdempotencyKey } from "../../../../../test/idempotency";

app.log.level = "silent";

const TODAY = todayInBusinessTz();
const addDays = (days: number) => {
  const d = new Date(`${TODAY}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

type Res = Awaited<ReturnType<typeof app.inject>>;

describe("Pagamentos de contas a receber (POST payments / reverse)", () => {
  let token: string;
  let userId: string;
  let customerId: string;
  const variants: { id: string; cleanup: () => Promise<void> }[] = [];

  const request = (method: "GET" | "POST", url: string, payload?: unknown) =>
    app.inject({ method, url, payload: payload as any, headers: withIdempotencyKey(method, { authorization: `Bearer ${token}` }) });

  const createPricedVariant = async (salePrice: number) => {
    const { variantId, cleanup } = await createTestVariant();
    variants.push({ id: variantId, cleanup });
    await prisma.productVariant.update({ where: { id: variantId }, data: { salePrice } });
    const res = await request("POST", "/inventory/lots", {
      productVariantId: variantId,
      batchNumber: `tx-test-${randomUUID().slice(0, 8)}`,
      quantity: 50,
      unitCost: 1,
      expirationDate: "2030-06-30T00:00:00.000Z",
    });
    assert.equal(res.statusCode, 200, res.body);
    return variantId;
  };

  /** Venda de `quantity` × `salePrice` em `installments` parcelas; devolve venda, documento e parcelas. */
  const createSaleReceivable = async (salePrice: number, quantity: number, installments = 1) => {
    const variantId = await createPricedVariant(salePrice);
    const res = await request("POST", "/sales", {
      customerId,
      items: [{ productVariantId: variantId, quantity }],
      paymentTerms: { installments, firstDueDate: addDays(30) },
    });
    assert.equal(res.statusCode, 201, res.body);
    const saleId = res.json().data.id as string;
    const doc = await prisma.financialDocument.findFirstOrThrow({
      where: { originId: saleId },
      include: { parcels: { orderBy: { dueDate: "asc" } } },
    });
    return { saleId, documentId: doc.id, parcelIds: doc.parcels.map((p) => p.id) };
  };

  const postPayment = (documentId: string, parcelId: string, body: Record<string, unknown>) =>
    request("POST", `/receivables/${documentId}/parcels/${parcelId}/payments`, body);
  const postReverse = (paymentId: string, body: Record<string, unknown>) =>
    request("POST", `/receivables/payments/${paymentId}/reverse`, body);

  const settled = (results: PromiseSettledResult<Res>[]) =>
    results.map((r) => {
      assert.equal(r.status, "fulfilled");
      return (r as PromiseFulfilledResult<Res>).value;
    });

  beforeEach(async () => {
    userId = await getTestUserId();
    token = signTestToken(userId);
    const tag = `tx-test-${randomUUID()}`;
    customerId = (await prisma.customer.create({ data: { name: tag, code: tag } })).id;
  });

  afterEach(async () => {
    const id = customerId;
    const toClean = variants.splice(0);
    try {
      try {
        await deleteFinancialDocuments({ where: { partyId: id } });
      } finally {
        await prisma.sale.deleteMany({ where: { customerId: id } });
      }
    } finally {
      try {
        for (const v of toClean) await v.cleanup();
      } finally {
        await prisma.customer.deleteMany({ where: { id } });
      }
    }
  });

  after(async () => {
    try {
      await app.close();
    } finally {
      await prisma.$disconnect();
    }
  });

  test("pagamento parcial → 201 { data: detalhe }, parcela e documento PARTIALLY_PAID; createdById do token", async () => {
    const { documentId, parcelIds } = await createSaleReceivable(50, 2, 2); // 2 × 50,00

    const res = await postPayment(documentId, parcelIds[0], {
      amount: 20.5,
      method: "PIX",
      reference: "  NSU-1  ",
    });
    assert.equal(res.statusCode, 201, res.body);
    const d = res.json().data;
    assert.equal(d.id, documentId);
    assert.equal(d.status, "PARTIALLY_PAID");
    assert.equal(d.paidAmount, 20.5);
    assert.equal(d.remainingAmount, 79.5);
    const [first, second] = d.parcels;
    assert.equal(first.id, parcelIds[0]);
    assert.equal(first.status, "PARTIALLY_PAID");
    assert.equal(first.remainingAmount, 29.5);
    assert.equal(second.status, "OPEN");
    assert.equal(first.payments.length, 1);
    const p = first.payments[0];
    assert.equal(p.amount, 20.5);
    assert.equal(p.method, "PIX");
    assert.equal(p.paymentDate, TODAY);
    assert.equal(p.reference, "NSU-1");
    assert.deepEqual(p.createdBy, { id: userId, name: "tx-test-inventory" });
    assert.equal(p.reversedAt, null);

    const row = await prisma.payment.findUniqueOrThrow({ where: { id: p.id } });
    assert.equal(row.createdById, userId);
    assert.equal(
      (await prisma.financialDocument.findUniqueOrThrow({ where: { id: documentId } })).status,
      "PARTIALLY_PAID",
    );
  });

  test("pagar todas as parcelas → documento PAID; 33,33 numa parcela de 33,34 → restante 0,01", async () => {
    const { documentId, parcelIds } = await createSaleReceivable(66.68, 1, 2); // 33,34 + 33,34
    const amounts = (await prisma.financialParcel.findMany({ where: { id: { in: parcelIds } } })).map((p) =>
      Number(p.amount),
    );
    assert.deepEqual(amounts, [33.34, 33.34]);
    const parcel3334 = parcelIds[0];

    const partial = await postPayment(documentId, parcel3334, { amount: 33.33, method: "CASH" });
    assert.equal(partial.statusCode, 201, partial.body);
    const p = partial.json().data.parcels.find((x: any) => x.id === parcel3334);
    assert.equal(p.remainingAmount, 0.01);
    assert.equal(p.status, "PARTIALLY_PAID");

    const tooMuch = await postPayment(documentId, parcel3334, { amount: 0.02, method: "CASH" });
    assert.equal(tooMuch.statusCode, 422, tooMuch.body);
    assert.equal(tooMuch.json().code, "PAYMENT_EXCEEDS_REMAINING");

    let last: Res | undefined;
    const parcels = await prisma.financialParcel.findMany({ where: { id: { in: parcelIds } }, include: { payments: true } });
    for (const parcel of parcels) {
      const paid = parcel.payments.reduce((s, x) => s + Math.round(Number(x.amount) * 100), 0);
      const remaining = (Math.round(Number(parcel.amount) * 100) - paid) / 100;
      last = await postPayment(documentId, parcel.id, { amount: remaining, method: "BOLETO" });
      assert.equal(last.statusCode, 201, last.body);
    }
    const d = last!.json().data;
    assert.equal(d.status, "PAID");
    assert.equal(d.displayStatus, "PAID");
    assert.equal(d.remainingAmount, 0);
    assert.equal(d.paidAmount, 66.68);
    for (const parcel of d.parcels) assert.equal(parcel.status, "PAID");
  });

  test("documento CANCELED → 409; parcela de outro documento → 404 PARCEL_NOT_FOUND; inexistente → 404", async () => {
    const a = await createSaleReceivable(10, 1);
    const b = await createSaleReceivable(10, 1);

    const wrong = await postPayment(a.documentId, b.parcelIds[0], { amount: 1, method: "PIX" });
    assert.equal(wrong.statusCode, 404, wrong.body);
    assert.equal(wrong.json().code, "PARCEL_NOT_FOUND");

    const missing = await postPayment(randomUUID(), a.parcelIds[0], { amount: 1, method: "PIX" });
    assert.equal(missing.statusCode, 404, missing.body);
    assert.equal(missing.json().code, "FINANCIAL_DOCUMENT_NOT_FOUND");

    assert.equal((await request("POST", `/sales/${a.saleId}/cancel`)).statusCode, 200);
    const canceled = await postPayment(a.documentId, a.parcelIds[0], { amount: 1, method: "PIX" });
    assert.equal(canceled.statusCode, 409, canceled.body);
    assert.equal(canceled.json().code, "FINANCIAL_DOCUMENT_CANCELED");
    assert.equal(await prisma.payment.count({ where: { parcelId: a.parcelIds[0] } }), 0);
  });

  test("paymentDate anterior à criação do título → 400 (campo paymentDate); no dia da criação → 201", async () => {
    const { documentId, parcelIds } = await createSaleReceivable(10, 1);

    const before = await postPayment(documentId, parcelIds[0], {
      amount: 1,
      method: "PIX",
      paymentDate: addDays(-1),
    });
    assert.equal(before.statusCode, 400, before.body);
    assert.equal(before.json().code, "VALIDATION_ERROR");
    assert.deepEqual(before.json().errors, [
      { field: "paymentDate", message: "A data do pagamento não pode ser anterior à criação do título." },
    ]);
    assert.equal(await prisma.payment.count({ where: { parcelId: parcelIds[0] } }), 0);

    const same = await postPayment(documentId, parcelIds[0], { amount: 1, method: "PIX", paymentDate: TODAY });
    assert.equal(same.statusCode, 201, same.body);
  });

  test("paymentDate futura → 400 (campo paymentDate); corpo inválido → 400", async () => {
    const { documentId, parcelIds } = await createSaleReceivable(10, 1);

    const future = await postPayment(documentId, parcelIds[0], {
      amount: 1,
      method: "PIX",
      paymentDate: addDays(1),
    });
    assert.equal(future.statusCode, 400, future.body);
    assert.equal(future.json().code, "VALIDATION_ERROR");
    assert.deepEqual(future.json().errors.map((e: any) => e.field), ["paymentDate"]);

    await prisma.financialDocument.update({
      where: { id: documentId },
      data: { createdAt: new Date(`${addDays(-10)}T12:00:00.000Z`) },
    });
    const past = await postPayment(documentId, parcelIds[0], {
      amount: 1,
      method: "DEBIT_CARD",
      paymentDate: addDays(-3),
    });
    assert.equal(past.statusCode, 201, past.body);
    assert.equal(past.json().data.parcels[0].payments[0].paymentDate, addDays(-3));

    const invalid: [Record<string, unknown>, string][] = [
      [{ amount: 0, method: "PIX" }, "amount"],
      [{ amount: -1, method: "PIX" }, "amount"],
      [{ amount: 1.001, method: "PIX" }, "amount"],
      [{ amount: "1", method: "PIX" }, "amount"],
      [{ amount: 1, method: "CHEQUE" }, "method"],
      [{ amount: 1 }, "method"],
      [{ amount: 1, method: "PIX", paymentDate: "2026-02-30" }, "paymentDate"],
      [{ amount: 1, method: "PIX", reference: "x".repeat(101) }, "reference"],
    ];
    for (const [body, field] of invalid) {
      const res = await postPayment(documentId, parcelIds[0], body);
      assert.equal(res.statusCode, 400, `${JSON.stringify(body)}: ${res.body}`);
      assert.ok(
        res.json().errors.some((e: any) => e.field === field),
        `${JSON.stringify(body)}: ${res.body}`,
      );
    }
    const badId = await postPayment("abc", parcelIds[0], { amount: 1, method: "PIX" });
    assert.equal(badId.statusCode, 400, badId.body);
  });

  test("estorno → status recalculado; documento PAID volta a PARTIALLY_PAID", async () => {
    const { documentId, parcelIds } = await createSaleReceivable(10, 2, 2); // 2 × 10,00
    await postPayment(documentId, parcelIds[0], { amount: 10, method: "PIX" });
    const paid = await postPayment(documentId, parcelIds[1], { amount: 10, method: "PIX" });
    assert.equal(paid.json().data.status, "PAID");
    const paymentId = paid.json().data.parcels[1].payments[0].id as string;

    const res = await postReverse(paymentId, { reason: "  Cheque devolvido  " });
    assert.equal(res.statusCode, 200, res.body);
    const d = res.json().data;
    assert.equal(d.id, documentId);
    assert.equal(d.status, "PARTIALLY_PAID");
    assert.equal(d.paidAmount, 10);
    assert.equal(d.parcels[1].status, "OPEN");
    const reversed = d.parcels[1].payments[0];
    assert.ok(reversed.reversedAt);
    assert.deepEqual(reversed.reversedBy, { id: userId, name: "tx-test-inventory" });
    assert.equal(reversed.reversalReason, "Cheque devolvido");
    assert.equal(
      (await prisma.financialDocument.findUniqueOrThrow({ where: { id: documentId } })).status,
      "PARTIALLY_PAID",
    );
  });

  test("estorno duplo → 409 PAYMENT_ALREADY_REVERSED; motivo ausente → 400; inexistente → 404", async () => {
    const { documentId, parcelIds } = await createSaleReceivable(10, 1);
    const paid = await postPayment(documentId, parcelIds[0], { amount: 5, method: "PIX" });
    const paymentId = paid.json().data.parcels[0].payments[0].id as string;

    for (const body of [{}, { reason: "" }, { reason: "  ab  " }, { reason: "x".repeat(201) }]) {
      const res = await postReverse(paymentId, body);
      assert.equal(res.statusCode, 400, `${JSON.stringify(body)}: ${res.body}`);
      assert.ok(res.json().errors.some((e: any) => e.field === "reason"), res.body);
    }

    assert.equal((await postReverse(paymentId, { reason: "erro de digitação" })).statusCode, 200);
    const again = await postReverse(paymentId, { reason: "erro de digitação" });
    assert.equal(again.statusCode, 409, again.body);
    assert.equal(again.json().code, "PAYMENT_ALREADY_REVERSED");

    const missing = await postReverse(randomUUID(), { reason: "abc" });
    assert.equal(missing.statusCode, 404, missing.body);
    assert.equal(missing.json().code, "PAYMENT_NOT_FOUND");
  });

  test("cancelar venda após pagamento estornado → permitido", async () => {
    const { saleId, documentId, parcelIds } = await createSaleReceivable(10, 1);
    const paid = await postPayment(documentId, parcelIds[0], { amount: 10, method: "PIX" });
    const paymentId = paid.json().data.parcels[0].payments[0].id as string;

    const blocked = await request("POST", `/sales/${saleId}/cancel`);
    assert.equal(blocked.statusCode, 409, blocked.body);
    assert.equal(blocked.json().code, "SALE_HAS_PAYMENTS");

    assert.equal((await postReverse(paymentId, { reason: "devolução" })).statusCode, 200);
    const res = await request("POST", `/sales/${saleId}/cancel`);
    assert.equal(res.statusCode, 200, res.body);
    assert.equal(
      (await prisma.financialDocument.findUniqueOrThrow({ where: { id: documentId } })).status,
      "CANCELED",
    );
  });

  test("pagamento × cancelamento da venda simultâneos → exatamente um conclui", async () => {
    for (let round = 0; round < 3; round++) {
      const { saleId, documentId, parcelIds } = await createSaleReceivable(10, 1);
      const [payment, cancel] = settled(
        await Promise.allSettled([
          postPayment(documentId, parcelIds[0], { amount: 4, method: "PIX" }),
          request("POST", `/sales/${saleId}/cancel`),
        ]),
      );
      const bodies = `${payment.body} | ${cancel.body}`;
      const doc = await prisma.financialDocument.findUniqueOrThrow({ where: { id: documentId } });
      const payments = await prisma.payment.count({ where: { parcelId: parcelIds[0] } });
      if (payment.statusCode === 201) {
        assert.equal(cancel.statusCode, 409, bodies);
        assert.equal(cancel.json().code, "SALE_HAS_PAYMENTS");
        assert.equal(doc.status, "PARTIALLY_PAID");
        assert.equal(payments, 1);
      } else {
        assert.equal(payment.statusCode, 409, bodies);
        assert.equal(payment.json().code, "FINANCIAL_DOCUMENT_CANCELED");
        assert.equal(cancel.statusCode, 200, bodies);
        assert.equal(doc.status, "CANCELED");
        assert.equal(payments, 0);
      }
    }
  });

  test("dois pagamentos simultâneos que juntos excedem → um 422", async () => {
    const { documentId, parcelIds } = await createSaleReceivable(10, 1);
    const results = settled(
      await Promise.allSettled([
        postPayment(documentId, parcelIds[0], { amount: 6, method: "PIX" }),
        postPayment(documentId, parcelIds[0], { amount: 6, method: "CASH" }),
      ]),
    );
    assert.deepEqual(
      results.map((r) => r.statusCode).sort(),
      [201, 422],
      results.map((r) => r.body).join(" | "),
    );
    assert.equal(results.find((r) => r.statusCode === 422)!.json().code, "PAYMENT_EXCEEDS_REMAINING");
    const rows = await prisma.payment.findMany({ where: { parcelId: parcelIds[0] } });
    assert.deepEqual(rows.map((r) => Number(r.amount)), [6]);
    assert.equal(
      (await prisma.financialDocument.findUniqueOrThrow({ where: { id: documentId } })).status,
      "PARTIALLY_PAID",
    );
  });

  test("lockById fora de transação → InternalInvariantError", async () => {
    await assert.rejects(
      new PrismaFinancialDocumentRepository().lockById(randomUUID()),
      (e: unknown) => e instanceof InternalInvariantError && e.code === "LOCK_OUTSIDE_TRANSACTION",
    );
  });
});
