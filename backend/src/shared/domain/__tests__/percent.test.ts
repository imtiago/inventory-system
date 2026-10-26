import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { applyBps, bpsToPercent, ceilDiv, percentToBps } from "../percent";
import { cost4ToCents, toCost4 } from "../cost4";

describe("percent", () => {
  test("percentToBps: 3.99 = 399; 0.1 + 0.2 = 30; > 2 casas → RangeError", () => {
    assert.equal(percentToBps(3.99), 399);
    assert.equal(percentToBps(0.1 + 0.2), 30);
    assert.equal(percentToBps(30), 3000);
    assert.equal(percentToBps(0), 0);
    assert.throws(() => percentToBps(3.999), RangeError);
    assert.throws(() => percentToBps(-1), RangeError);
    assert.throws(() => percentToBps(Number.NaN), RangeError);
  });
  test("bpsToPercent", () => {
    assert.equal(bpsToPercent(399), 3.99);
    assert.equal(bpsToPercent(3000), 30);
  });
  test("applyBps arredonda meio para cima", () => {
    const cases: [number, number, number][] = [
      [10000, 350, 350], [2090, 2000, 418], [1, 5000, 1], [1, 4999, 0], [0, 3000, 0], [199, 250, 5],
    ];
    cases.forEach(([c, b, o]) => assert.equal(applyBps(c, b), o));
  });
  test("ceilDiv", () => {
    assert.equal(ceilDiv(10, 5), 2);
    assert.equal(ceilDiv(11, 5), 3);
    assert.equal(ceilDiv(0, 5), 0);
    assert.throws(() => ceilDiv(1, 0), RangeError);
    assert.throws(() => ceilDiv(-1, 2), RangeError);
  });
});

describe("cost4", () => {
  test("toCost4 e cost4ToCents", () => {
    assert.equal(toCost4(10), 100000);
    assert.equal(toCost4(0.0001), 1);
    assert.equal(toCost4(1.1 + 2.2), 33000);
    assert.throws(() => toCost4(0.00001), RangeError);
    assert.equal(cost4ToCents(100000), 1000);
    assert.equal(cost4ToCents(50), 1);
    assert.equal(cost4ToCents(49), 0);
  });
});
