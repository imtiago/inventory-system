import { test } from "node:test";
import assert from "node:assert/strict";
import { availableCents } from "@credit/domain/customerCredit";

test("availableCents = max(limite − saldo, 0)", () => {
  assert.equal(availableCents(30000, { openBalanceCents: 12000, currentMaxOverdueDays: 0 }), 18000);
  assert.equal(availableCents(10000, { openBalanceCents: 12000, currentMaxOverdueDays: 3 }), 0);
  assert.equal(availableCents(0, { openBalanceCents: 0, currentMaxOverdueDays: 0 }), 0);
  assert.throws(() => availableCents(-1, { openBalanceCents: 0, currentMaxOverdueDays: 0 }));
});
