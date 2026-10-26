import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { prorateCents } from "../prorate";

const sum = (a: number[]) => a.reduce((s, n) => s + n, 0);

describe("prorateCents", () => {
  test("1000 em [1, 1, 1] = [334, 333, 333]; soma 1000", () => {
    const parts = prorateCents(1000, [1, 1, 1]);
    assert.deepEqual(parts, [334, 333, 333]);
    assert.equal(sum(parts), 1000);
  });

  test("pesos todos zero: partes iguais, resto pelo menor índice", () => {
    assert.deepEqual(prorateCents(1, [0, 0]), [1, 0]);
    assert.deepEqual(prorateCents(5, [0, 0, 0]), [2, 2, 1]);
  });

  test("proporcional: 1000 em [30, 60, 10] = [300, 600, 100]", () => {
    assert.deepEqual(prorateCents(1000, [3000, 6000, 1000]), [300, 600, 100]);
  });

  test("maior resto vence; soma sempre exata", () => {
    const parts = prorateCents(100, [1, 2, 4]);
    assert.equal(sum(parts), 100);
    assert.deepEqual(parts, [14, 29, 57]);
  });

  test("total zero e entradas inválidas", () => {
    assert.deepEqual(prorateCents(0, [1, 2]), [0, 0]);
    assert.throws(() => prorateCents(-1, [1]), RangeError);
    assert.throws(() => prorateCents(1, []), RangeError);
    assert.throws(() => prorateCents(1, [-1, 2]), RangeError);
  });
});
