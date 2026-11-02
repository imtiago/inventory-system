import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { reviewDecision, scoreCredit, type CreditHistory } from "../creditScore";
import { canAutoApprove } from "../autoApproval";
import { DEFAULT_CREDIT_RULES } from "../creditRules";
import { CreditProfileCode } from "../CreditProfileCode";

const review = DEFAULT_CREDIT_RULES.review;
const w = review.weights;

const clean: CreditHistory = {
  paidOnTime: 0,
  paidLate30Plus: 0,
  totalDaysLate: 0,
  relationshipMonths: 0,
  totalPaidCents: 0,
  renegotiations: 0,
  maxDaysLateInPeriod: 0,
  currentMaxOverdueDays: 0,
  paidInstallments: 0,
};

describe("scoreCredit", () => {
  const cases: { name: string; history: Partial<CreditHistory>; expected: number }[] = [
    { name: "sem histórico → 0", history: {}, expected: 0 },
    { name: "9 em dia → 90", history: { paidOnTime: 9 }, expected: 90 },
    { name: "meses limitados a 24 (×2)", history: { relationshipMonths: 30 }, expected: 48 },
    { name: "R$ 1.299,99 pagos → 12 pontos (por R$ 100 inteiros)", history: { totalPaidCents: 129999 }, expected: 12 },
    { name: "total pago limitado a 50", history: { totalPaidCents: 10_000_000 }, expected: 50 },
    {
      name: "negativos: 12 dias de atraso, 1 pago com 30+, 1 renegociação",
      history: { paidOnTime: 5, relationshipMonths: 6, totalPaidCents: 50000, totalDaysLate: 12, paidLate30Plus: 1, renegotiations: 1 },
      expected: 50 + 12 + 5 - 12 - 15 - 20,
    },
  ];
  for (const c of cases) {
    test(c.name, () => assert.equal(scoreCredit({ ...clean, ...c.history }, w), c.expected));
  }
});

describe("reviewDecision", () => {
  const decide = (profile: CreditProfileCode, history: Partial<CreditHistory>) => {
    const h = { ...clean, ...history };
    return reviewDecision({ profile, score: scoreCredit(h, w), history: h, rules: review });
  };

  test("9 em dia, 0 atraso, Novo com 40+ pontos → UP 'subiu para Regular: 9 parcelas em dia, 0 atrasos'", () => {
    assert.deepEqual(decide(CreditProfileCode.NEW, { paidOnTime: 9, paidInstallments: 9 }), {
      action: "UP",
      reason: "subiu para Regular: 9 parcelas em dia, 0 atrasos",
    });
  });

  test("patamar inclusivo: Novo com exatamente 40 → UP; 39 → NONE", () => {
    assert.equal(reviewDecision({ profile: CreditProfileCode.NEW, score: 40, history: clean, rules: review }).action, "UP");
    assert.equal(reviewDecision({ profile: CreditProfileCode.NEW, score: 39, history: clean, rules: review }).action, "NONE");
  });

  test("Bom com 150 → UP 'subiu para Excelente: …'", () => {
    const d = reviewDecision({ profile: CreditProfileCode.GOOD, score: 150, history: { ...clean, paidOnTime: 12, paidInstallments: 14 }, rules: review });
    assert.deepEqual(d, { action: "UP", reason: "subiu para Excelente: 12 parcelas em dia, 2 atrasos" });
  });

  test("Excelente não sobe", () => {
    assert.equal(reviewDecision({ profile: CreditProfileCode.EXCELLENT, score: 999, history: clean, rules: review }).action, "NONE");
  });

  test("atraso aberto impede subir", () => {
    assert.equal(reviewDecision({ profile: CreditProfileCode.NEW, score: 100, history: { ...clean, currentMaxOverdueDays: 1 }, rules: review }).action, "NONE");
  });

  test("atraso de 31 dias no período → DOWN; 30 → não desce", () => {
    assert.deepEqual(decide(CreditProfileCode.GOOD, { maxDaysLateInPeriod: 31 }), {
      action: "DOWN",
      reason: "desceu para Regular: atraso de 31 dias no período",
    });
    assert.equal(decide(CreditProfileCode.GOOD, { maxDaysLateInPeriod: 30 }).action, "NONE");
  });

  test("parcela vencida em aberto há 45 dias também desce", () => {
    assert.equal(decide(CreditProfileCode.REGULAR, { currentMaxOverdueDays: 45 }).action, "DOWN");
  });

  test("Novo com atraso de 31 dias → NONE (não há perfil abaixo)", () => {
    assert.equal(decide(CreditProfileCode.NEW, { maxDaysLateInPeriod: 31 }).action, "NONE");
  });

  test("parcela vencida há 61 dias → SUSPEND; 60 → DOWN", () => {
    assert.deepEqual(decide(CreditProfileCode.GOOD, { currentMaxOverdueDays: 61, maxDaysLateInPeriod: 61 }), {
      action: "SUSPEND",
      reason: "suspenso: parcela vencida há 61 dias",
    });
    assert.equal(decide(CreditProfileCode.GOOD, { currentMaxOverdueDays: 60 }).action, "DOWN");
  });

  test("prioridade SUSPEND > DOWN > UP", () => {
    // pontuação alta mas atraso de 31 → DOWN, não UP
    assert.equal(reviewDecision({ profile: CreditProfileCode.REGULAR, score: 500, history: { ...clean, maxDaysLateInPeriod: 31 }, rules: review }).action, "DOWN");
    // Novo vencido há 61 → SUSPEND mesmo sem perfil abaixo
    assert.equal(reviewDecision({ profile: CreditProfileCode.NEW, score: 500, history: { ...clean, currentMaxOverdueDays: 61 }, rules: review }).action, "SUSPEND");
  });
});

describe("canAutoApprove", () => {
  const auto = DEFAULT_CREDIT_RULES.autoApproval;
  const good: CreditHistory = { ...clean, paidInstallments: 6, maxDaysLateInPeriod: 5 };
  const run = (over: Partial<Parameters<typeof canAutoApprove>[0]>) =>
    canAutoApprove({ profile: CreditProfileCode.GOOD, history: good, currentLimitCents: 200000, requestedLimitCents: 300000, rules: auto, ...over });

  test("Bom, 6 pagas, atraso máx 5, pedido 3.000 sobre 2.000 → true", () => assert.equal(run({}), true));
  test("pedido 3.000,01 → false", () => assert.equal(run({ requestedLimitCents: 300001 }), false));
  test("Regular → false", () => assert.equal(run({ profile: CreditProfileCode.REGULAR }), false));
  test("Excelente → true", () => assert.equal(run({ profile: CreditProfileCode.EXCELLENT }), true));
  test("5 pagas → false", () => assert.equal(run({ history: { ...good, paidInstallments: 5 } }), false));
  test("atraso de 6 dias no período → false", () => assert.equal(run({ history: { ...good, maxDaysLateInPeriod: 6 } }), false));
  test("parcela vencida em aberto há 6 dias → false", () => assert.equal(run({ history: { ...good, currentMaxOverdueDays: 6 } }), false));
});
