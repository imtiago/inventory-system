import { test } from "node:test";
import assert from "node:assert/strict";
import { ConflictError } from "@shared/domain/errors";
import { FinancialDocument } from "@finance/domain/entities/FinancialDocument";
import { FinancialParcel } from "@finance/domain/entities/FinancialParcel";
import { Payment } from "@finance/domain/entities/Payment";
import { FinancialType } from "@finance/domain/enums/FinancialType";
import { FinancialOriginType } from "@finance/domain/enums/FinancialOriginType";
import { FinancialPartyType } from "@finance/domain/enums/FinancialPartyType";
import { FinancialStatus } from "@finance/domain/enums/FinancialStatus";
import { ParcelStatus } from "@finance/domain/enums/ParcelStatus";
import { PaymentMethod } from "@finance/domain/enums/PaymentMethod";
import { parcelStatus } from "@finance/domain/services/receivableStatus";

const TODAY = "2026-10-23";

const payment = (amountCents: number, parcelId = "p-1") =>
  new Payment({ parcelId, amountCents, method: PaymentMethod.PIX, paymentDate: TODAY, reference: null });

const parcel = (amountCents: number, dueDate: string, payments: Payment[] = [], id = "p-1") =>
  new FinancialParcel({ id, financialDocumentId: "d-1", amountCents, dueDate, payments });

const doc = (parcels: FinancialParcel[], status = FinancialStatus.OPEN) =>
  new FinancialDocument({
    id: "d-1",
    type: FinancialType.RECEIVABLE,
    originId: "sale-1",
    originType: FinancialOriginType.SALE,
    partyId: "c-1",
    partyType: FinancialPartyType.CUSTOMER,
    status,
    parcels,
  });

test("parcela com vencimento hoje (negócio) → OPEN; ontem → OVERDUE", () => {
  assert.equal(parcel(1000, TODAY).status(TODAY), ParcelStatus.OPEN);
  assert.equal(parcel(1000, "2026-10-22").status(TODAY), ParcelStatus.OVERDUE);
  assert.equal(parcel(1000, "2026-10-24").status(TODAY), ParcelStatus.OPEN);
  // Função pura compartilhada com o detalhe da venda.
  assert.equal(
    parcelStatus({ amountCents: 1000, paidCents: 0, dueDate: TODAY, documentStatus: "OPEN" }, TODAY),
    "OPEN",
  );
  assert.equal(
    parcelStatus({ amountCents: 1000, paidCents: 0, dueDate: "2026-10-22", documentStatus: "OPEN" }, TODAY),
    "OVERDUE",
  );
});

test("pagamento parcial → PARTIALLY_PAID; quitado → PAID (em centavos)", () => {
  const p = parcel(3334, "2026-10-01", [payment(3333)]);
  assert.equal(p.paidCents, 3333);
  assert.equal(p.remainingCents, 1);
  assert.equal(p.status(TODAY), ParcelStatus.PARTIALLY_PAID);
  assert.equal(parcel(3334, "2026-10-01", [payment(3333), payment(1)]).status(TODAY), ParcelStatus.PAID);
});

test("pagamento estornado não conta em paid; parcela volta a OPEN", () => {
  const pay = payment(1000);
  const p = parcel(1000, TODAY, [pay]);
  assert.equal(p.status(TODAY), ParcelStatus.PAID);

  pay.reverse("u-1", "Lançado por engano");
  assert.ok(pay.isReversed);
  assert.equal(pay.reversedById, "u-1");
  assert.equal(pay.reversalReason, "Lançado por engano");
  assert.ok(pay.reversedAt instanceof Date);
  assert.equal(p.paidCents, 0);
  assert.equal(p.remainingCents, 1000);
  assert.equal(p.status(TODAY), ParcelStatus.OPEN);
});

test("estornar pagamento já estornado → ConflictError PAYMENT_ALREADY_REVERSED", () => {
  const pay = payment(1000);
  pay.reverse("u-1", "motivo");
  assert.throws(
    () => pay.reverse("u-2", "outro"),
    (e: unknown) => e instanceof ConflictError && e.code === "PAYMENT_ALREADY_REVERSED",
  );
  assert.equal(pay.reversedById, "u-1");
});

test("pagamento com valor ≤ 0 → erro INVALID_PAYMENT_AMOUNT", () => {
  assert.throws(() => payment(0), (e: any) => e.code === "INVALID_PAYMENT_AMOUNT");
});

test("documento CANCELED → parcelas CANCELED", () => {
  const p = parcel(1000, "2026-10-01");
  const d = doc([p], FinancialStatus.CANCELED);
  assert.equal(d.parcelStatus(p, TODAY), ParcelStatus.CANCELED);
  assert.equal(p.status(TODAY, FinancialStatus.CANCELED), ParcelStatus.CANCELED);
  assert.equal(
    parcelStatus({ amountCents: 1000, paidCents: 0, dueDate: "2026-10-01", documentStatus: "CANCELED" }, TODAY),
    "CANCELED",
  );
});

test("recalculateStatus: todas pagas → PAID; parcial → PARTIALLY_PAID; nenhum → OPEN; CANCELED mantém", () => {
  const allPaid = doc([parcel(1000, TODAY, [payment(1000)], "a"), parcel(500, TODAY, [payment(500, "b")], "b")]);
  allPaid.recalculateStatus();
  assert.equal(allPaid.status, FinancialStatus.PAID);

  const partial = doc([parcel(1000, TODAY, [payment(1000)], "a"), parcel(500, TODAY, [], "b")]);
  partial.recalculateStatus();
  assert.equal(partial.status, FinancialStatus.PARTIALLY_PAID);

  const reversed = payment(1000);
  reversed.reverse("u-1", "estorno");
  const none = doc([parcel(1000, TODAY, [reversed])], FinancialStatus.PAID);
  none.recalculateStatus();
  assert.equal(none.status, FinancialStatus.OPEN);

  const canceled = doc([parcel(1000, TODAY, [payment(1000)])], FinancialStatus.CANCELED);
  canceled.recalculateStatus();
  assert.equal(canceled.status, FinancialStatus.CANCELED);

  assert.equal(allPaid.totalCents, 1500);
  assert.equal(partial.paidCents, 1000);
  assert.equal(partial.remainingCents, 500);
});
