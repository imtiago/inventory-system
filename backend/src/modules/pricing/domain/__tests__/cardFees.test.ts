import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { cardFeeBps, netAfterCardFee, priceWithCardFee, type CardFees } from "../cardFees";
import { InternalInvariantError } from "@shared/domain/errors";

const credit: Record<number, number> = {};
for (let i = 1; i <= 12; i++) credit[i] = 300 + i * 10;
const fees: CardFees = { debitBps: 150, creditBps: credit };

describe("cardFees", () => {
  test("repasse: 100,00 com taxa 3,5% → 103,63 (para cima)", () => assert.equal(priceWithCardFee(10000, 350), 10363));
  test("repasse com taxa 0 não altera", () => assert.equal(priceWithCardFee(10000, 0), 10000));
  test("líquido sem repasse: 100,00 com 3,5% → 96,50", () => assert.equal(netAfterCardFee(10000, 350), 9650));
  test("cardFeeBps: crédito 3x usa creditBps[3]; débito ignora parcelas", () => {
    assert.equal(cardFeeBps(fees, "CREDIT", 3), 330);
    assert.equal(cardFeeBps(fees, "CREDIT", 1), 310);
    assert.equal(cardFeeBps(fees, "CREDIT", 12), 420);
    assert.equal(cardFeeBps(fees, "DEBIT", 1), 150);
    assert.equal(cardFeeBps(fees, "DEBIT", 99), 150);
  });
  test("parcelas fora de 1..12 → InternalInvariantError", () => {
    [0, 13, 1.5, -1].forEach((n) => assert.throws(() => cardFeeBps(fees, "CREDIT", n), InternalInvariantError));
  });
});
