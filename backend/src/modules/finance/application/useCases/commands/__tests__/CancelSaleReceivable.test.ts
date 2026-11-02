import { test } from "node:test";
import assert from "node:assert/strict";
import { CancelSaleReceivableUseCase } from "../CancelSaleReceivableUseCase";
import { FinancialDocument } from "@finance/domain/entities/FinancialDocument";
import { FinancialParcel } from "@finance/domain/entities/FinancialParcel";
import { Payment } from "@finance/domain/entities/Payment";
import { FinancialDocumentRepository } from "@finance/domain/repositories/FinancialDocumentRepository";
import { PaymentRepository } from "@finance/domain/repositories/PaymentRepository";
import { FinancialType } from "@finance/domain/enums/FinancialType";
import { FinancialOriginType } from "@finance/domain/enums/FinancialOriginType";
import { FinancialPartyType } from "@finance/domain/enums/FinancialPartyType";
import { FinancialStatus } from "@finance/domain/enums/FinancialStatus";
import { PaymentMethod } from "@finance/domain/enums/PaymentMethod";
import { InMemoryTransactionManager } from "../../../../../../test/InMemoryTransactionManager";

/** Documento com uma parcela de 10,00; `paid` = pagamento integral (atCheckout ou de parcela). */
const newDoc = (paid?: "atCheckout" | "installment" | "reversed") => {
  const doc = new FinancialDocument({
    type: FinancialType.RECEIVABLE,
    originId: "sale-1",
    originType: FinancialOriginType.SALE,
    partyId: "c-1",
    partyType: FinancialPartyType.CUSTOMER,
  });
  const parcel = new FinancialParcel({ amountCents: 1000, dueDate: "2026-10-27", financialDocumentId: doc.id });
  if (paid) {
    parcel.addPayment(
      new Payment({
        parcelId: parcel.id,
        amountCents: 1000,
        method: PaymentMethod.CASH,
        reference: null,
        paymentDate: "2026-10-27",
        atCheckout: paid !== "installment",
        reversedAt: paid === "reversed" ? new Date() : null,
      }),
    );
  }
  doc.addParcel(parcel);
  doc.recalculateStatus();
  return doc;
};

function build(docs: FinancialDocument[]) {
  const log: string[] = [];
  const updated: FinancialDocument[] = [];
  const reversed: Payment[] = [];
  const repo: FinancialDocumentRepository = {
    create: async (d) => d,
    lockByOrigin: async (type, originType, originId) => {
      log.push(`lock:${type}:${originType}:${originId}`);
      return docs;
    },
    lockById: async () => null,
    hasPayments: async () => {
      throw new Error("não usado: os pagamentos vêm do documento travado");
    },
    update: async (d) => {
      log.push(`update:${d.id}`);
      updated.push(d);
      return d;
    },
  };
  const payments: PaymentRepository = {
    create: async () => {},
    saveReversal: async (p) => {
      log.push(`reverse:${p.id}`);
      reversed.push(p);
    },
    findDocumentId: async () => null,
  };
  const uc = new CancelSaleReceivableUseCase(repo, payments, new InMemoryTransactionManager());
  return { uc, log, updated, reversed };
}

const input = { saleId: "sale-1", userId: "u-1", checkoutRefundAllowed: true };

test("trava os documentos da venda antes de checar pagamentos e cancela todos", async () => {
  const a = newDoc();
  const b = newDoc("reversed");
  const { uc, log, updated } = build([a, b]);
  await uc.execute(input);
  assert.deepEqual(log, ["lock:RECEIVABLE:SALE:sale-1", `update:${a.id}`, `update:${b.id}`]);
  assert.deepEqual(updated.map((d) => d.status), [FinancialStatus.CANCELED, FinancialStatus.CANCELED]);
});

test("pagamento de parcela em qualquer documento → 409 SALE_HAS_PAYMENTS; nada gravado", async () => {
  const a = newDoc("atCheckout");
  const b = newDoc("installment");
  const { uc, updated, reversed } = build([a, b]);
  await assert.rejects(() => uc.execute(input), {
    name: "ConflictError",
    code: "SALE_HAS_PAYMENTS",
    message: "Venda com pagamentos registrados não pode ser cancelada.",
  });
  assert.equal(updated.length, 0);
  assert.equal(reversed.length, 0);
});

test("pagamento do fechamento dentro da janela → estornado ('Venda cancelada', quem cancelou) e documento cancelado", async () => {
  const doc = newDoc("atCheckout");
  assert.equal(doc.status, FinancialStatus.PAID);
  const { uc, log, updated, reversed } = build([doc]);
  await uc.execute(input);
  const payment = doc.parcels[0].payments[0];
  assert.deepEqual(log, ["lock:RECEIVABLE:SALE:sale-1", `reverse:${payment.id}`, `update:${doc.id}`]);
  assert.equal(reversed[0].reversalReason, "Venda cancelada");
  assert.equal(reversed[0].reversedById, "u-1");
  assert.equal(updated[0].status, FinancialStatus.CANCELED);
});

test("pagamento do fechamento fora da janela → 409 CHECKOUT_REFUND_WINDOW_EXPIRED; nada gravado", async () => {
  const doc = newDoc("atCheckout");
  const { uc, updated, reversed } = build([doc]);
  await assert.rejects(() => uc.execute({ ...input, checkoutRefundAllowed: false }), {
    name: "ConflictError",
    code: "CHECKOUT_REFUND_WINDOW_EXPIRED",
    message: "Venda paga no ato só pode ser cancelada com estorno em até 7 dias.",
  });
  assert.equal(updated.length, 0);
  assert.equal(reversed.length, 0);
  assert.equal(doc.parcels[0].payments[0].isReversed, false);
});

test("fora da janela mas sem pagamento ativo (já estornado) → cancela normalmente", async () => {
  const doc = newDoc("reversed");
  const { uc, updated } = build([doc]);
  await uc.execute({ ...input, checkoutRefundAllowed: false });
  assert.equal(updated[0].status, FinancialStatus.CANCELED);
});

test("venda sem documento: nada a fazer", async () => {
  const { uc, log } = build([]);
  await uc.execute(input);
  assert.deepEqual(log, ["lock:RECEIVABLE:SALE:sale-1"]);
});
