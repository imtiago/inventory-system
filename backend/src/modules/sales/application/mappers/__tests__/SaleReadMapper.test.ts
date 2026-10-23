import { test } from "node:test";
import assert from "node:assert/strict";
import { SaleDetailRow, SaleReadMapper } from "@sales/application/mappers/SaleReadMapper";

const sale: SaleDetailRow = {
  id: "s-1",
  status: "COMPLETED",
  totalAmount: "100.00",
  createdAt: new Date("2026-10-22T12:00:00.000Z"),
  customer: { id: "c-1", name: "Cliente" },
  seller: null,
  items: [],
};

const receivable = (dueDate: string, payments: { amount: string; reversedAt: Date | null }[] = []) => ({
  id: "d-1",
  status: "OPEN",
  parcels: [{ id: "p-1", amount: "100.00", dueDate: new Date(`${dueDate}T00:00:00.000Z`), payments }],
});

// 22:30 em Brasília de 22/10 = 01:30 UTC de 23/10.
const NIGHT_IN_BRASILIA = new Date("2026-10-23T01:30:00.000Z");

test("GET /sales/:id parcela que vence hoje (fuso de negócio) → OPEN, mesmo após 21h em Brasília", () => {
  const dto = SaleReadMapper.toDetailDTO(sale, receivable("2026-10-22"), NIGHT_IN_BRASILIA);
  assert.equal(dto.receivable!.parcels[0].status, "OPEN");
  assert.equal(dto.receivable!.parcels[0].dueDate, "2026-10-22");
});

test("detalhe da venda: parcela vencida ontem (negócio) → OVERDUE", () => {
  const dto = SaleReadMapper.toDetailDTO(sale, receivable("2026-10-21"), NIGHT_IN_BRASILIA);
  assert.equal(dto.receivable!.parcels[0].status, "OVERDUE");
});

test("detalhe da venda: pagamento estornado não conta em paidAmount", () => {
  const dto = SaleReadMapper.toDetailDTO(
    sale,
    receivable("2026-10-22", [
      { amount: "30.00", reversedAt: null },
      { amount: "70.00", reversedAt: new Date() },
    ]),
    NIGHT_IN_BRASILIA,
  );
  const parcel = dto.receivable!.parcels[0];
  assert.equal(parcel.paidAmount, 30);
  assert.equal(parcel.remainingAmount, 70);
  assert.equal(parcel.status, "PARTIALLY_PAID");
});
