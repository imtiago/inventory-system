import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { computeLateFees, parcelLateFees } from "../lateFees";
import { InternalInvariantError } from "@shared/domain/errors";
import { todayInBusinessTz } from "@shared/domain/businessDate";

const base = {
  principalRemainingCents: 10000,
  dueDate: "2026-11-10",
  graceDays: 3,
  fineBps: 200,
  monthlyInterestBps: 100,
  fineAlreadyCharged: false,
  interestFrom: null,
};

describe("computeLateFees", () => {
  const cases: { name: string; paymentDate: string; expected: { daysLate: number; fineCents: number; interestCents: number } }[] = [
    { name: "pago antes do vencimento → zero", paymentDate: "2026-11-05", expected: { daysLate: 0, fineCents: 0, interestCents: 0 } },
    { name: "vencimento hoje → daysLate 0", paymentDate: "2026-11-10", expected: { daysLate: 0, fineCents: 0, interestCents: 0 } },
    { name: "1 dia (carência) → zero", paymentDate: "2026-11-11", expected: { daysLate: 1, fineCents: 0, interestCents: 0 } },
    { name: "paga 11-13 → zero (carência 3)", paymentDate: "2026-11-13", expected: { daysLate: 3, fineCents: 0, interestCents: 0 } },
    { name: "paga 11-14 → multa 2,00, juros 0,13 (4 dias desde o vencimento)", paymentDate: "2026-11-14", expected: { daysLate: 4, fineCents: 200, interestCents: 13 } },
    { name: "paga 11-20 → multa 2,00, juros 0,33", paymentDate: "2026-11-20", expected: { daysLate: 10, fineCents: 200, interestCents: 33 } },
    { name: "paga 12-10 → 30 dias, juros 1,00", paymentDate: "2026-12-10", expected: { daysLate: 30, fineCents: 200, interestCents: 100 } },
  ];
  for (const c of cases) {
    test(c.name, () => assert.deepEqual(computeLateFees({ ...base, paymentDate: c.paymentDate }), c.expected));
  }

  test("segundo pagamento em 12-20 sobre 50,00, multa já cobrada, juros desde 11-20 → multa 0, juros 0,50", () => {
    assert.deepEqual(
      computeLateFees({ ...base, principalRemainingCents: 5000, paymentDate: "2026-12-20", fineAlreadyCharged: true, interestFrom: "2026-11-20" }),
      { daysLate: 40, fineCents: 0, interestCents: 50 },
    );
  });

  test("interestFrom anterior ao vencimento não antecipa juros", () => {
    assert.deepEqual(
      computeLateFees({ ...base, paymentDate: "2026-11-20", interestFrom: "2026-11-01" }),
      { daysLate: 10, fineCents: 200, interestCents: 33 },
    );
  });

  test("multa limitada a 2% (CDC) mesmo configurada acima", () => {
    assert.equal(computeLateFees({ ...base, paymentDate: "2026-11-20", fineBps: 500 }).fineCents, 200);
  });

  test("multa arredonda meio para cima: 2% de 0,25 → 0,01", () => {
    assert.equal(computeLateFees({ ...base, principalRemainingCents: 25, paymentDate: "2026-11-20" }).fineCents, 1);
  });

  test("saldo zero → sem encargos", () => {
    assert.deepEqual(computeLateFees({ ...base, principalRemainingCents: 0, paymentDate: "2026-11-20" }), { daysLate: 10, fineCents: 0, interestCents: 0 });
  });

  test("virada de mês/ano conta dias corridos", () => {
    assert.deepEqual(
      computeLateFees({ ...base, dueDate: "2026-12-30", paymentDate: "2027-01-04" }),
      { daysLate: 5, fineCents: 200, interestCents: 17 },
    );
  });

  test("meia-noite em São Paulo: 23h30 do 3º dia (02h30Z do 4º) ainda está na carência (Review Focus 3)", () => {
    const paymentDate = todayInBusinessTz(new Date("2026-11-14T02:30:00.000Z"));
    assert.equal(paymentDate, "2026-11-13");
    assert.deepEqual(computeLateFees({ ...base, paymentDate }), { daysLate: 3, fineCents: 0, interestCents: 0 });
  });

  test("00h05 de São Paulo do 4º dia (03h05Z) já cobra", () => {
    const paymentDate = todayInBusinessTz(new Date("2026-11-14T03:05:00.000Z"));
    assert.equal(paymentDate, "2026-11-14");
    assert.deepEqual(computeLateFees({ ...base, paymentDate }), { daysLate: 4, fineCents: 200, interestCents: 13 });
  });

  test("entrada inválida → InternalInvariantError", () => {
    assert.throws(() => computeLateFees({ ...base, paymentDate: "2026-11-31" }), InternalInvariantError);
    assert.throws(() => computeLateFees({ ...base, paymentDate: "2026-11-20", principalRemainingCents: -1 }), InternalInvariantError);
    assert.throws(() => computeLateFees({ ...base, paymentDate: "2026-11-20", graceDays: -1 }), InternalInvariantError);
    assert.throws(() => computeLateFees({ ...base, paymentDate: "2026-11-20", interestFrom: "x" }), InternalInvariantError);
  });
});

describe("parcelLateFees", () => {
  const rates = { graceDays: 3, fineBps: 200, monthlyInterestBps: 100 };
  const pay = (amountCents: number, fineCents: number, interestCents: number, paymentDate: string, reversed = false) => ({
    amountCents,
    fineCents,
    interestCents,
    paymentDate,
    reversed,
  });

  test("restante, multa já cobrada e juros desde o último pagamento com encargo", () => {
    const r = parcelLateFees({
      amountCents: 10_000,
      dueDate: "2026-11-10",
      payments: [pay(4_000, 200, 33, "2026-11-20"), pay(1_000, 0, 0, "2026-11-25", true)],
      paymentDate: "2026-11-30",
      rates,
      exempt: false,
    });
    assert.deepEqual(r, { principalRemainingCents: 6_000, daysLate: 20, fineCents: 0, interestCents: 20 });
  });

  test("pagamento com encargo estornado → volta a cobrar multa e juros desde o vencimento", () => {
    const r = parcelLateFees({
      amountCents: 10_000,
      dueDate: "2026-11-10",
      payments: [pay(4_000, 200, 33, "2026-11-20", true)],
      paymentDate: "2026-11-30",
      rates,
      exempt: false,
    });
    assert.deepEqual(r, { principalRemainingCents: 10_000, daysLate: 20, fineCents: 200, interestCents: 67 });
  });

  test("documento isento → zero (dias de atraso continuam informados)", () => {
    const r = parcelLateFees({ amountCents: 10_000, dueDate: "2026-11-10", payments: [], paymentDate: "2026-12-10", rates, exempt: true });
    assert.deepEqual(r, { principalRemainingCents: 10_000, daysLate: 30, fineCents: 0, interestCents: 0 });
  });
});
