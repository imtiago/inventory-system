import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { roundPrice } from "../priceRounding";

describe("roundPrice", () => {
  const cases: [number, number][] = [
    [730, 750], [760, 790], [750, 750], [790, 790], [795, 850], [995, 1090],
    [3818, 3890], [3890, 3890], [9995, 10990],
    [13210, 13990], [99995, 100900],
    [120300, 120900], [120900, 120900], [120901, 121900],
  ];
  test("STORE_TABLE arredonda sempre para cima na faixa da spec", () =>
    cases.forEach(([i, o]) => assert.equal(roundPrice(i, "STORE_TABLE"), o, `${i}`)));
  test("END_90 / END_99 / INTEGER / NONE", () => {
    assert.equal(roundPrice(3818, "END_90"), 3890);
    assert.equal(roundPrice(3891, "END_90"), 3990);
    assert.equal(roundPrice(3818, "END_99"), 3899);
    assert.equal(roundPrice(3801, "INTEGER"), 3900);
    assert.equal(roundPrice(3800, "INTEGER"), 3800);
    assert.equal(roundPrice(3818, "NONE"), 3818);
  });
});
