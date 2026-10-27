import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { bandMaxInstallments, DEFAULT_CREDIT_RULES, maxInstallmentsFor, minDownPaymentCents } from "../creditRules";
import { CreditProfileCode, DEFAULT_CREDIT_PROFILES, CREDIT_PROFILE_LABELS, nextProfile, previousProfile } from "../CreditProfileCode";

const rules = DEFAULT_CREDIT_RULES;
const profile = (code: CreditProfileCode) => DEFAULT_CREDIT_PROFILES.find((p) => p.code === code)!;

describe("perfis", () => {
  test("rótulos e valores iniciais da spec", () => {
    assert.deepEqual(CREDIT_PROFILE_LABELS, { NEW: "Novo", REGULAR: "Regular", GOOD: "Bom", EXCELLENT: "Excelente" });
    assert.deepEqual(
      DEFAULT_CREDIT_PROFILES.map((p) => [p.code, p.name, p.initialLimitCents, p.minDownPaymentBps, p.maxInstallments]),
      [
        ["NEW", "Novo", 30000, 3000, 3],
        ["REGULAR", "Regular", 80000, 1500, 5],
        ["GOOD", "Bom", 200000, 0, 8],
        ["EXCELLENT", "Excelente", 500000, 0, 10],
      ],
    );
  });
  test("próximo e anterior; extremos → null", () => {
    assert.equal(nextProfile(CreditProfileCode.NEW), CreditProfileCode.REGULAR);
    assert.equal(nextProfile(CreditProfileCode.GOOD), CreditProfileCode.EXCELLENT);
    assert.equal(nextProfile(CreditProfileCode.EXCELLENT), null);
    assert.equal(previousProfile(CreditProfileCode.REGULAR), CreditProfileCode.NEW);
    assert.equal(previousProfile(CreditProfileCode.NEW), null);
  });
});

describe("regras padrão", () => {
  test("valores do Global Constraints", () => {
    assert.deepEqual(rules.bands, [
      { upToCents: 15000, maxInstallments: 2 },
      { upToCents: 30000, maxInstallments: 3 },
      { upToCents: 60000, maxInstallments: 5 },
      { upToCents: 100000, maxInstallments: 8 },
      { upToCents: null, maxInstallments: 10 },
    ]);
    assert.equal(rules.minInstallmentCents, 3000);
    assert.equal(rules.interestFreeInstallments, 2);
    assert.equal(rules.monthlyRateBps, 399);
    assert.equal(rules.defaultDueDay, null);
    assert.equal(rules.overdueBlockDays, 10);
    assert.equal(rules.fineBps, 200);
    assert.equal(rules.monthlyInterestBps, 100);
    assert.equal(rules.graceDays, 3);
    assert.deepEqual(rules.autoApproval, {
      profiles: [CreditProfileCode.GOOD, CreditProfileCode.EXCELLENT],
      maxDaysLate: 5,
      minPaidInstallments: 6,
      maxIncreaseBps: 5000,
    });
    assert.deepEqual(rules.review, {
      weights: { paidOnTime: 10, relationshipMonth: 2, relationshipMonthsCap: 24, per100Paid: 1, per100PaidCap: 50, dayLate: -1, paidLate30: -15, renegotiation: -20 },
      promoteAt: { NEW: 40, REGULAR: 80, GOOD: 150 },
      demoteIfDaysLateOver: 30,
      suspendIfOverdueOver: 60,
    });
  });
});

describe("máximo de parcelas", () => {
  const bandCases: [number, number][] = [
    [1, 2],
    [15000, 2],
    [15001, 3],
    [30000, 3],
    [30001, 5],
    [60000, 5],
    [60001, 8],
    [100000, 8],
    [100001, 10],
    [10_000_000, 10],
  ];
  for (const [financed, expected] of bandCases) {
    test(`faixa: financiado ${financed} → ${expected}x`, () => {
      assert.equal(bandMaxInstallments(financed, rules.bands), expected);
      // Excelente (10x) e parcela mínima folgada: vale a faixa.
      if (financed >= 30000) assert.equal(maxInstallmentsFor(financed, rules, profile(CreditProfileCode.EXCELLENT)), expected);
    });
  }
  test("faixas fora de ordem são lidas em ordem crescente", () => {
    assert.equal(bandMaxInstallments(20000, [{ upToCents: null, maxInstallments: 10 }, { upToCents: 30000, maxInstallments: 3 }, { upToCents: 15000, maxInstallments: 2 }]), 3);
  });
  test("parcela mínima: R$ 45,00 → 1x por causa dos R$ 30", () => {
    assert.equal(maxInstallmentsFor(4500, rules, profile(CreditProfileCode.EXCELLENT)), 1);
  });
  test("parcela mínima: R$ 20,00 → 1x (mínimo 1)", () => {
    assert.equal(maxInstallmentsFor(2000, rules, profile(CreditProfileCode.EXCELLENT)), 1);
  });
  test("perfil: R$ 400,00 Novo → 3x (faixa daria 5x)", () => {
    assert.equal(maxInstallmentsFor(40000, rules, profile(CreditProfileCode.NEW)), 3);
    assert.equal(maxInstallmentsFor(40000, rules, profile(CreditProfileCode.REGULAR)), 5);
  });
  test("R$ 150,01 Excelente → 3x (faixa); parcela mínima daria 5x", () => {
    assert.equal(maxInstallmentsFor(15001, rules, profile(CreditProfileCode.EXCELLENT)), 3);
  });
});

describe("entrada mínima", () => {
  test("Novo (30%) de R$ 333,33 → 100,00 (para cima)", () => {
    assert.equal(minDownPaymentCents(33333, profile(CreditProfileCode.NEW)), 10000);
  });
  test("Regular (15%) de R$ 100,01 → 15,01 (para cima)", () => {
    assert.equal(minDownPaymentCents(10001, profile(CreditProfileCode.REGULAR)), 1501);
  });
  test("Bom (0%) → 0", () => {
    assert.equal(minDownPaymentCents(99999, profile(CreditProfileCode.GOOD)), 0);
  });
});
