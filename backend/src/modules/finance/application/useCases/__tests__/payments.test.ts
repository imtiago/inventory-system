import { test } from "node:test";
import assert from "node:assert/strict";
import { FinancialDocument } from "@finance/domain/entities/FinancialDocument";
import { FinancialParcel } from "@finance/domain/entities/FinancialParcel";
import { Payment } from "@finance/domain/entities/Payment";
import { FinancialType } from "@finance/domain/enums/FinancialType";
import { FinancialOriginType } from "@finance/domain/enums/FinancialOriginType";
import { FinancialPartyType } from "@finance/domain/enums/FinancialPartyType";
import { FinancialStatus } from "@finance/domain/enums/FinancialStatus";
import { ParcelStatus } from "@finance/domain/enums/ParcelStatus";
import { PaymentMethod } from "@finance/domain/enums/PaymentMethod";
import { FinancialDocumentRepository } from "@finance/domain/repositories/FinancialDocumentRepository";
import { PaymentRepository } from "@finance/domain/repositories/PaymentRepository";
import { InMemoryTransactionManager } from "@shared/application/transaction/InMemoryTransactionManager";
import { FinancialDocumentDetailDTO } from "../../dto/FinancialDocumentReadDTO";
import { RegisterPaymentUseCase } from "../commands/RegisterPaymentUseCase";
import { ReversePaymentUseCase } from "../commands/ReversePaymentUseCase";

const TODAY = "2026-10-23";

function newDoc(parcelsCents: number[], opts: { status?: FinancialStatus; type?: FinancialType } = {}) {
  const doc = new FinancialDocument({
    type: opts.type ?? FinancialType.RECEIVABLE,
    originId: "sale-1",
    originType: FinancialOriginType.SALE,
    partyId: "c-1",
    partyType: FinancialPartyType.CUSTOMER,
    status: opts.status,
    createdAt: new Date("2026-09-01T12:00:00.000Z"),
  });
  parcelsCents.forEach((amountCents, i) =>
    doc.addParcel(
      new FinancialParcel({ amountCents, dueDate: `2026-11-0${i + 1}`, financialDocumentId: doc.id }),
    ),
  );
  return doc;
}

function build(docs: FinancialDocument[], type: FinancialType = FinancialType.RECEIVABLE) {
  const log: string[] = [];
  const created: Payment[] = [];
  const reversed: Payment[] = [];
  const updated: { id: string; status: FinancialStatus }[] = [];
  const documents: FinancialDocumentRepository = {
    create: async (d) => d,
    lockByOrigin: async () => [],
    hasPayments: async () => false,
    lockById: async (id) => {
      log.push(`lock:${id}`);
      return docs.find((d) => d.id === id) ?? null;
    },
    update: async (d) => {
      log.push(`update:${d.id}`);
      updated.push({ id: d.id, status: d.status });
      return d;
    },
  };
  const payments: PaymentRepository = {
    create: async (p) => {
      log.push(`createPayment:${p.parcelId}`);
      created.push(p);
    },
    saveReversal: async (p) => {
      log.push(`reverse:${p.id}`);
      reversed.push(p);
    },
    findDocumentId: async (paymentId) => {
      log.push(`find:${paymentId}`);
      return (
        docs.find((d) => d.parcels.some((pa) => pa.payments.some((p) => p.id === paymentId)))?.id ?? null
      );
    },
  };
  const detail = { execute: async (id: string) => ({ id }) as unknown as FinancialDocumentDetailDTO };
  const tm = new InMemoryTransactionManager();
  const register = new RegisterPaymentUseCase(type, documents, payments, tm, detail, () => TODAY);
  const reverse = new ReversePaymentUseCase(type, documents, payments, tm, detail);
  return { register, reverse, log, created, reversed, updated };
}

const pay = (doc: FinancialDocument, parcelIndex: number, amount: number, extra: Record<string, unknown> = {}) => ({
  documentId: doc.id,
  parcelId: doc.parcels[parcelIndex].id,
  amount,
  method: PaymentMethod.PIX,
  userId: "user-1",
  ...extra,
});

test("pagamento parcial → parcela PARTIALLY_PAID, documento PARTIALLY_PAID", async () => {
  const doc = newDoc([10000, 10000]);
  const { register, log, created, updated } = build([doc]);

  const result = await register.execute(pay(doc, 0, 40));

  assert.equal(result.id, doc.id);
  assert.deepEqual(log, [`lock:${doc.id}`, `createPayment:${doc.parcels[0].id}`, `update:${doc.id}`]);
  assert.equal(created.length, 1);
  assert.equal(created[0].amountCents, 4000);
  assert.equal(created[0].method, PaymentMethod.PIX);
  assert.equal(doc.parcelStatus(doc.parcels[0], TODAY), ParcelStatus.PARTIALLY_PAID);
  assert.equal(doc.parcelStatus(doc.parcels[1], TODAY), ParcelStatus.OPEN);
  assert.deepEqual(updated, [{ id: doc.id, status: FinancialStatus.PARTIALLY_PAID }]);
});

test("pagar todas as parcelas → documento PAID", async () => {
  const doc = newDoc([5000, 2550]);
  const { register, updated } = build([doc]);

  await register.execute(pay(doc, 0, 50));
  await register.execute(pay(doc, 1, 25.5));

  assert.equal(doc.status, FinancialStatus.PAID);
  assert.deepEqual(updated.map((u) => u.status), [FinancialStatus.PARTIALLY_PAID, FinancialStatus.PAID]);
  for (const p of doc.parcels) assert.equal(doc.parcelStatus(p, TODAY), ParcelStatus.PAID);
});

test("33,33 numa parcela de 33,34 → restante 0,01", async () => {
  const doc = newDoc([3334]);
  const { register } = build([doc]);

  await register.execute(pay(doc, 0, 33.33));

  assert.equal(doc.parcels[0].paidCents, 3333);
  assert.equal(doc.parcels[0].remainingCents, 1);
  assert.equal(doc.status, FinancialStatus.PARTIALLY_PAID);

  await register.execute(pay(doc, 0, 0.01));
  assert.equal(doc.parcels[0].remainingCents, 0);
  assert.equal(doc.status, FinancialStatus.PAID);
});

test("valor acima do restante → 422 PAYMENT_EXCEEDS_REMAINING", async () => {
  const doc = newDoc([3334]);
  const { register, created, updated } = build([doc]);
  await register.execute(pay(doc, 0, 33.33));

  await assert.rejects(() => register.execute(pay(doc, 0, 0.02)), {
    name: "BusinessRuleError",
    code: "PAYMENT_EXCEEDS_REMAINING",
  });
  assert.equal(created.length, 1);
  assert.equal(updated.length, 1);
  assert.equal(doc.parcels[0].payments.length, 1);
});

test("documento CANCELED → 409 FINANCIAL_DOCUMENT_CANCELED", async () => {
  const doc = newDoc([1000], { status: FinancialStatus.CANCELED });
  const { register, created } = build([doc]);

  await assert.rejects(() => register.execute(pay(doc, 0, 1)), {
    name: "ConflictError",
    code: "FINANCIAL_DOCUMENT_CANCELED",
  });
  assert.equal(created.length, 0);
});

test("parcela de outro documento → 404 PARCEL_NOT_FOUND; documento inexistente → 404", async () => {
  const a = newDoc([1000]);
  const b = newDoc([1000]);
  const payable = newDoc([1000], { type: FinancialType.PAYABLE });
  const { register, created } = build([a, b, payable]);

  await assert.rejects(
    () => register.execute({ ...pay(a, 0, 1), parcelId: b.parcels[0].id }),
    { name: "NotFoundError", code: "PARCEL_NOT_FOUND" },
  );
  await assert.rejects(
    () => register.execute({ ...pay(a, 0, 1), documentId: "missing" }),
    { name: "NotFoundError", code: "FINANCIAL_DOCUMENT_NOT_FOUND" },
  );
  await assert.rejects(() => register.execute(pay(payable, 0, 1)), {
    name: "NotFoundError",
    code: "FINANCIAL_DOCUMENT_NOT_FOUND",
  });
  assert.equal(created.length, 0);
});

test("paymentDate futura → 400; padrão = hoje negócio; createdById do token", async () => {
  const doc = newDoc([10000]);
  const { register, created, log } = build([doc]);

  await assert.rejects(
    () => register.execute(pay(doc, 0, 1, { paymentDate: "2026-10-24" })),
    (e: any) =>
      e.name === "ValidationError" &&
      e.code === "VALIDATION_ERROR" &&
      e.errors.length === 1 &&
      e.errors[0].field === "paymentDate",
  );
  assert.equal(log.length, 0, "não deve travar nada com data inválida");

  await register.execute(pay(doc, 0, 1, { reference: "  NSU 123  " }));
  await register.execute(pay(doc, 0, 1, { paymentDate: "2026-10-01", reference: "   " }));
  assert.equal(created[0].paymentDate, TODAY);
  assert.equal(created[0].createdById, "user-1");
  assert.equal(created[0].reference, "NSU 123");
  assert.equal(created[1].paymentDate, "2026-10-01");
  assert.equal(created[1].reference, null);
});

test("estorno → status recalculado; documento PAID volta a PARTIALLY_PAID", async () => {
  const doc = newDoc([5000, 5000]);
  const { register, reverse, reversed, updated, log } = build([doc]);
  await register.execute(pay(doc, 0, 50));
  await register.execute(pay(doc, 1, 50));
  assert.equal(doc.status, FinancialStatus.PAID);
  const paymentId = doc.parcels[1].payments[0].id;
  log.length = 0;

  const result = await reverse.execute({ paymentId, reason: "Cheque devolvido", userId: "user-2" });

  assert.equal(result.id, doc.id);
  assert.deepEqual(log, [`find:${paymentId}`, `lock:${doc.id}`, `reverse:${paymentId}`, `update:${doc.id}`]);
  assert.equal(reversed.length, 1);
  assert.equal(reversed[0].reversedById, "user-2");
  assert.equal(reversed[0].reversalReason, "Cheque devolvido");
  assert.ok(reversed[0].reversedAt instanceof Date);
  assert.equal(doc.status, FinancialStatus.PARTIALLY_PAID);
  assert.equal(updated.at(-1)!.status, FinancialStatus.PARTIALLY_PAID);
  assert.equal(doc.parcelStatus(doc.parcels[1], TODAY), ParcelStatus.OPEN);

  // Estornar o restante → OPEN.
  await reverse.execute({ paymentId: doc.parcels[0].payments[0].id, reason: "erro", userId: "user-2" });
  assert.equal(doc.status, FinancialStatus.OPEN);
});

test("estorno duplo → 409 PAYMENT_ALREADY_REVERSED; inexistente → 404; documento CANCELED → 409", async () => {
  const doc = newDoc([5000]);
  const { register, reverse, reversed } = build([doc]);
  await register.execute(pay(doc, 0, 10));
  const paymentId = doc.parcels[0].payments[0].id;

  await reverse.execute({ paymentId, reason: "duplicado", userId: "user-1" });
  await assert.rejects(() => reverse.execute({ paymentId, reason: "de novo", userId: "user-1" }), {
    name: "ConflictError",
    code: "PAYMENT_ALREADY_REVERSED",
  });
  assert.equal(reversed.length, 1);

  await assert.rejects(() => reverse.execute({ paymentId: "missing", reason: "abc", userId: "user-1" }), {
    name: "NotFoundError",
    code: "PAYMENT_NOT_FOUND",
  });

  const canceled = newDoc([5000], { status: FinancialStatus.CANCELED });
  canceled.parcels[0].addPayment(
    new Payment({
      parcelId: canceled.parcels[0].id,
      amountCents: 100,
      method: PaymentMethod.CASH,
      reference: null,
      paymentDate: TODAY,
    }),
  );
  const other = build([canceled]);
  await assert.rejects(
    () => other.reverse.execute({ paymentId: canceled.parcels[0].payments[0].id, reason: "abc", userId: "u" }),
    { name: "ConflictError", code: "FINANCIAL_DOCUMENT_CANCELED" },
  );
  assert.equal(other.reversed.length, 0);
});

test("paymentDate anterior à criação do título (data de negócio) → 400 sem gravar", async () => {
  const doc = newDoc([10000]);
  const { register, created } = build([doc]);

  await assert.rejects(
    () => register.execute(pay(doc, 0, 1, { paymentDate: "2026-08-31" })),
    (e: any) =>
      e.name === "ValidationError" &&
      e.errors[0].field === "paymentDate" &&
      e.errors[0].message === "A data do pagamento não pode ser anterior à criação do título.",
  );
  assert.equal(created.length, 0);
  await register.execute(pay(doc, 0, 1, { paymentDate: "2026-09-01" }));
  assert.equal(created.length, 1);
});

test("tipo do caso de uso ≠ tipo do documento → 404 nos dois sentidos, sem gravar", async () => {
  const receivable = newDoc([1000]);
  const payable = newDoc([1000], { type: FinancialType.PAYABLE });
  const forReceivables = build([receivable, payable]);
  const forPayables = build([receivable, payable], FinancialType.PAYABLE);

  // Pagamentos válidos no tipo certo (para testar o estorno cruzado).
  await forReceivables.register.execute(pay(receivable, 0, 1));
  await forPayables.register.execute(pay(payable, 0, 1));

  await assert.rejects(() => forPayables.register.execute(pay(receivable, 0, 1)), {
    name: "NotFoundError",
    code: "FINANCIAL_DOCUMENT_NOT_FOUND",
    message: "Conta a pagar não encontrada.",
  });
  await assert.rejects(() => forReceivables.register.execute(pay(payable, 0, 1)), {
    name: "NotFoundError",
    code: "FINANCIAL_DOCUMENT_NOT_FOUND",
    message: "Conta a receber não encontrada.",
  });
  const receivablePaymentId = receivable.parcels[0].payments[0].id;
  const payablePaymentId = payable.parcels[0].payments[0].id;
  await assert.rejects(
    () => forPayables.reverse.execute({ paymentId: receivablePaymentId, reason: "abc", userId: "u" }),
    { name: "NotFoundError", code: "PAYMENT_NOT_FOUND" },
  );
  await assert.rejects(
    () => forReceivables.reverse.execute({ paymentId: payablePaymentId, reason: "abc", userId: "u" }),
    { name: "NotFoundError", code: "PAYMENT_NOT_FOUND" },
  );
  assert.equal(forReceivables.created.length + forPayables.created.length, 2);
  assert.equal(forReceivables.reversed.length + forPayables.reversed.length, 0);
  assert.equal(receivable.parcels[0].payments.length, 1);
  assert.equal(payable.parcels[0].payments.length, 1);
});
