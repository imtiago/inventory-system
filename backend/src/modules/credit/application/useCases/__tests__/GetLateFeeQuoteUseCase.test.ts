import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_CREDIT_RULES } from "@credit/domain/creditRules";
import { LateFeeService } from "@credit/application/services/LateFeeService";
import { GetLateFeeQuoteUseCase } from "@credit/application/useCases/GetLateFeeQuoteUseCase";
import { FinancialDocument } from "@finance/domain/entities/FinancialDocument";
import { FinancialParcel } from "@finance/domain/entities/FinancialParcel";
import { FinancialType } from "@finance/domain/enums/FinancialType";
import { FinancialOriginType } from "@finance/domain/enums/FinancialOriginType";
import { FinancialPartyType } from "@finance/domain/enums/FinancialPartyType";

const settings = { get: async () => ({ crediarioEnabled: true, rules: structuredClone(DEFAULT_CREDIT_RULES) }) };

function documentDue(dueDate: string) {
  const document = new FinancialDocument({
    type: FinancialType.RECEIVABLE,
    originType: FinancialOriginType.SALE,
    originId: "sale",
    partyType: FinancialPartyType.CUSTOMER,
    partyId: "customer",
    createdAt: new Date("2026-10-01T12:00:00Z"),
  });
  const parcel = new FinancialParcel({ amountCents: 10_000, dueDate, financialDocumentId: document.id });
  document.addParcel(parcel);
  return { document, parcel };
}

describe("GetLateFeeQuoteUseCase — data de negócio (São Paulo)", () => {
  const makeUseCase = (now: Date, document: FinancialDocument) =>
    new GetLateFeeQuoteUseCase(
      { findById: async (id: string) => (id === document.id ? document : null) },
      new LateFeeService(settings),
      () => now,
    );

  test("quote às 23h30 de 2026-11-13 em São Paulo (02h30Z de 11-14) usa a data de negócio 11-13 → zero", async () => {
    const { document, parcel } = documentDue("2026-11-10");
    const quote = await makeUseCase(new Date("2026-11-14T02:30:00Z"), document).execute({
      documentId: document.id,
      parcelId: parcel.id,
    });
    assert.deepEqual(quote, { principalRemaining: 100, daysLate: 3, fine: 0, interest: 0, totalDue: 100 });
  });

  test("às 00h05 de 11-14 em São Paulo (03h05Z) já cobra: 4 dias → multa 2,00 + juros 0,13", async () => {
    const { document, parcel } = documentDue("2026-11-10");
    const quote = await makeUseCase(new Date("2026-11-14T03:05:00Z"), document).execute({
      documentId: document.id,
      parcelId: parcel.id,
    });
    assert.deepEqual(quote, { principalRemaining: 100, daysLate: 4, fine: 2, interest: 0.13, totalDue: 102.13 });
  });

  test("vencimento hoje não conta atraso", async () => {
    const { document, parcel } = documentDue("2026-11-14");
    const quote = await makeUseCase(new Date("2026-11-14T15:00:00Z"), document).execute({
      documentId: document.id,
      parcelId: parcel.id,
    });
    assert.equal(quote.daysLate, 0);
    assert.equal(quote.totalDue, 100);
  });
});
