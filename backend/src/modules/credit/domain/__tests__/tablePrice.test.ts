import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { buildPricePlan } from "../tablePrice";
import { InternalInvariantError } from "@shared/domain/errors";

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe("buildPricePlan (Tabela Price em centavos)", () => {
  const cases: { name: string; principal: number; n: number; parcels: number[]; total: number }[] = [
    { name: "R$ 1.000,00, 3,99%, 3x → 360,28 ×3; total 1.080,84", principal: 100000, n: 3, parcels: [36028, 36028, 36028], total: 108084 },
    { name: "R$ 1.000,00, 5x → 4 × 224,56 e última 224,58; total 1.122,82", principal: 100000, n: 5, parcels: [22456, 22456, 22456, 22456, 22458], total: 112282 },
    { name: "R$ 500,00, 10x → 9 × 61,61 e última 61,68; total 616,17", principal: 50000, n: 10, parcels: [...Array(9).fill(6161), 6168], total: 61617 },
    { name: "R$ 150,01, 3x → 54,05, 54,05, 54,04 (última pode ser menor)", principal: 15001, n: 3, parcels: [5405, 5405, 5404], total: 16214 },
    { name: "R$ 2.000,00, 8x → 7 × 296,93 e última 296,97; total 2.375,48", principal: 200000, n: 8, parcels: [...Array(7).fill(29693), 29697], total: 237548 },
  ];
  for (const c of cases) {
    test(c.name, () => {
      const plan = buildPricePlan(c.principal, 399, c.n);
      assert.deepEqual(plan.parcels, c.parcels);
      assert.equal(plan.installmentCents, c.parcels[0]);
      assert.equal(plan.totalCents, c.total);
      assert.equal(sum(plan.parcels), plan.totalCents);
    });
  }

  test("só a última parcela difere (Review Focus 2)", () => {
    for (const n of [2, 3, 4, 5, 6, 7, 8, 9, 10]) {
      const { parcels, installmentCents } = buildPricePlan(123457, 399, n);
      assert.equal(parcels.length, n);
      parcels.slice(0, -1).forEach((p) => assert.equal(p, installmentCents));
    }
  });

  test("taxa 0 → divisão simples, a última recebe o resto", () => {
    assert.deepEqual(buildPricePlan(10001, 0, 3), { installmentCents: 3333, parcels: [3333, 3333, 3335], totalCents: 10001 });
  });

  test("1x com taxa → principal + um mês de juros", () => {
    assert.deepEqual(buildPricePlan(100000, 399, 1), { installmentCents: 103990, parcels: [103990], totalCents: 103990 });
  });

  test("entrada inválida → InternalInvariantError", () => {
    assert.throws(() => buildPricePlan(-1, 399, 3), InternalInvariantError);
    assert.throws(() => buildPricePlan(100.5, 399, 3), InternalInvariantError);
    assert.throws(() => buildPricePlan(10000, -1, 3), InternalInvariantError);
    assert.throws(() => buildPricePlan(10000, 399, 0), InternalInvariantError);
    assert.throws(() => buildPricePlan(10000, 399, 1.5), InternalInvariantError);
  });
});
