import { test } from "node:test";
import assert from "node:assert/strict";
import { FinancialDocument } from "@finance/domain/entities/FinancialDocument";
import { FinancialType } from "@finance/domain/enums/FinancialType";
import { FinancialOriginType } from "@finance/domain/enums/FinancialOriginType";
import { FinancialPartyType } from "@finance/domain/enums/FinancialPartyType";
import { FinancialStatus } from "@finance/domain/enums/FinancialStatus";
import { InternalInvariantError } from "@shared/domain/errors";

const doc = (status: FinancialStatus) =>
  new FinancialDocument({
    type: FinancialType.RECEIVABLE,
    originId: "sale-1",
    originType: FinancialOriginType.SALE,
    partyId: "c-1",
    partyType: FinancialPartyType.CUSTOMER,
    status,
  });

test("cancel() em documento OPEN ou PARTIALLY_PAID → CANCELED", () => {
  for (const status of [FinancialStatus.OPEN, FinancialStatus.PARTIALLY_PAID]) {
    const d = doc(status);
    d.cancel();
    assert.equal(d.status, FinancialStatus.CANCELED);
  }
});

test("cancel() em documento PAID ou já CANCELED → InternalInvariantError", () => {
  for (const status of [FinancialStatus.PAID, FinancialStatus.CANCELED]) {
    const d = doc(status);
    assert.throws(
      () => d.cancel(),
      (e: unknown) => e instanceof InternalInvariantError && e.code === "FINANCIAL_DOCUMENT_NOT_CANCELABLE",
    );
    assert.equal(d.status, status);
  }
});
