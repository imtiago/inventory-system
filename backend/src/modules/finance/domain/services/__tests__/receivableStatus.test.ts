import { test } from "node:test";
import assert from "node:assert/strict";
import { FinancialParcel } from "@finance/domain/entities/FinancialParcel";
import { FinancialOriginType } from "@finance/domain/enums/FinancialOriginType";
import { FinancialStatus } from "@finance/domain/enums/FinancialStatus";
import { ParcelStatus } from "@finance/domain/enums/ParcelStatus";
import {
  documentDisplayStatus,
  hasOverdueBalance,
  parcelStatus,
} from "@finance/domain/services/receivableStatus";
import { FinancialDocumentReadMapper } from "@finance/application/mappers/FinancialDocumentReadMapper";

const TODAY = "2026-11-10";
const PAST = "2026-10-01";

test("parcelStatus com dueDateUnknown e vencimento no passado → OPEN; hasOverdueBalance → false", () => {
  const unknown = { amountCents: 10000, paidCents: 0, dueDate: PAST, dueDateUnknown: true };
  assert.equal(parcelStatus({ ...unknown, documentStatus: FinancialStatus.OPEN }, TODAY), ParcelStatus.OPEN);
  assert.equal(hasOverdueBalance(unknown, TODAY), false);
  // Parcial a combinar continua parcial; quitada continua paga; cancelado continua cancelado.
  assert.equal(
    parcelStatus({ ...unknown, paidCents: 100, documentStatus: FinancialStatus.PARTIALLY_PAID }, TODAY),
    ParcelStatus.PARTIALLY_PAID,
  );
  assert.equal(hasOverdueBalance({ ...unknown, paidCents: 100 }, TODAY), false);
  assert.equal(parcelStatus({ ...unknown, documentStatus: FinancialStatus.CANCELED }, TODAY), ParcelStatus.CANCELED);
  // Sem a marca, a mesma parcela está vencida.
  assert.equal(parcelStatus({ ...unknown, dueDateUnknown: false, documentStatus: FinancialStatus.OPEN }, TODAY), ParcelStatus.OVERDUE);
  assert.equal(hasOverdueBalance({ ...unknown, dueDateUnknown: false }, TODAY), true);
  // Documento só com parcela a combinar nunca é exibido como vencido.
  assert.equal(documentDisplayStatus(FinancialStatus.OPEN, [unknown], TODAY), FinancialStatus.OPEN);
});

test("entidade: parcela a combinar expõe dueDateUnknown e nunca fica OVERDUE", () => {
  const parcel = new FinancialParcel({ financialDocumentId: "d-1", amountCents: 5000, dueDate: PAST, dueDateUnknown: true });
  assert.equal(parcel.dueDateUnknown, true);
  assert.equal(parcel.status(TODAY), ParcelStatus.OPEN);
  const dated = new FinancialParcel({ financialDocumentId: "d-1", amountCents: 5000, dueDate: PAST });
  assert.equal(dated.dueDateUnknown, false);
  assert.equal(dated.status(TODAY), ParcelStatus.OVERDUE);
});

test("origem LEGACY existe no enum do domínio", () => {
  assert.equal(FinancialOriginType.LEGACY, "LEGACY");
});

test("mapper de leitura: a combinar soma em aberto (não vencido), fica fora do próximo vencimento e marca a parcela", () => {
  const row = {
    id: "d-1",
    status: "OPEN",
    originType: "LEGACY",
    originId: "row-1",
    partyId: "c-1",
    createdAt: new Date(),
    noLateFees: true,
    parcels: [{ id: "p-1", amount: 120, dueDate: new Date(`${PAST}T00:00:00.000Z`), dueDateUnknown: true, payments: [] }],
  };
  const figures = FinancialDocumentReadMapper.figures(row, TODAY);
  assert.equal(figures.displayStatus, FinancialStatus.OPEN);
  assert.equal(figures.overdueCents, 0);
  assert.equal(figures.notDueCents, 12000);
  assert.equal(figures.nextDueDate, null);
  assert.equal(figures.hasDueDateUnknown, true);
  const detail = FinancialDocumentReadMapper.toDetailDTO(row, TODAY);
  assert.equal(detail.parcels[0].status, ParcelStatus.OPEN);
  assert.equal(detail.parcels[0].dueDateUnknown, true);
  const summary = FinancialDocumentReadMapper.toSummaryDTO(row, TODAY);
  assert.equal(summary.parcels[0].status, ParcelStatus.OPEN);
  assert.equal(summary.displayStatus, FinancialStatus.OPEN);
});
