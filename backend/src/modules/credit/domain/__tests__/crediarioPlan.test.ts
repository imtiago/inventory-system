import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { crediarioOptions } from "../crediarioPlan";
import { DEFAULT_CREDIT_RULES } from "../creditRules";
import { CreditProfileCode, DEFAULT_CREDIT_PROFILES } from "../CreditProfileCode";
import { InternalInvariantError } from "@shared/domain/errors";

const rules = DEFAULT_CREDIT_RULES;
const profile = (code: CreditProfileCode) => DEFAULT_CREDIT_PROFILES.find((p) => p.code === code)!;

describe("crediarioOptions", () => {
  test("sem acréscimo até 2x: R$ 100,01 em 2x → 50,00 + 50,01, surcharge 0", () => {
    const options = crediarioOptions({ totalCents: 10001, downPaymentCents: 0, rules, profile: profile(CreditProfileCode.EXCELLENT) });
    assert.equal(options.length, 2); // faixa até R$ 150 → 2x
    assert.deepEqual(options[1], {
      installments: 2,
      downPaymentCents: 0,
      financedCents: 10001,
      installmentCents: 5000,
      lastInstallmentCents: 5001,
      parcels: [5000, 5001],
      totalCents: 10001,
      surchargeCents: 0,
      surchargeBps: 0,
    });
    assert.deepEqual(options[0].parcels, [10001]);
  });

  test("R$ 1.200,00 com entrada 200,00, Bom → 1..8x; 5x é Price 4 × 224,56 + 224,58", () => {
    const options = crediarioOptions({ totalCents: 120000, downPaymentCents: 20000, rules, profile: profile(CreditProfileCode.GOOD) });
    assert.deepEqual(options.map((o) => o.installments), [1, 2, 3, 4, 5, 6, 7, 8]);
    const five = options[4];
    assert.deepEqual(five, {
      installments: 5,
      downPaymentCents: 20000,
      financedCents: 100000,
      installmentCents: 22456,
      lastInstallmentCents: 22458,
      parcels: [22456, 22456, 22456, 22456, 22458],
      totalCents: 20000 + 112282,
      surchargeCents: 12282,
      surchargeBps: 1228, // 12,282% → 12,28%
    });
    assert.equal(options[1].surchargeCents, 0);
    assert.equal(options[2].surchargeCents, 8084); // 3x Price: 1.080,84
    for (const o of options) assert.equal(o.totalCents, o.downPaymentCents + o.parcels.reduce((a, b) => a + b, 0));
  });

  test("Novo com R$ 400,00 financiado → só até 3x", () => {
    const options = crediarioOptions({ totalCents: 57143, downPaymentCents: 17143, rules, profile: profile(CreditProfileCode.NEW) });
    assert.equal(options.length, 3);
  });

  test("entrada igual ao total → nenhuma opção", () => {
    assert.deepEqual(crediarioOptions({ totalCents: 10000, downPaymentCents: 10000, rules, profile: profile(CreditProfileCode.GOOD) }), []);
  });

  test("entrada negativa ou maior que o total → InternalInvariantError", () => {
    assert.throws(() => crediarioOptions({ totalCents: 10000, downPaymentCents: -1, rules, profile: profile(CreditProfileCode.GOOD) }), InternalInvariantError);
    assert.throws(() => crediarioOptions({ totalCents: 10000, downPaymentCents: 10001, rules, profile: profile(CreditProfileCode.GOOD) }), InternalInvariantError);
  });
});
