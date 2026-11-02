import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { crediarioDueDates } from "../dueDates";
import { InternalInvariantError } from "@shared/domain/errors";
import { todayInBusinessTz } from "@shared/domain/businessDate";

describe("crediarioDueDates", () => {
  const cases: { name: string; today: string; n: number; day: number | null; expected: string[] }[] = [
    { name: "hoje 2026-10-26, sem dia → +30 dias e depois mesmo dia", today: "2026-10-26", n: 3, day: null, expected: ["2026-11-25", "2026-12-25", "2027-01-25"] },
    { name: "dia 28, hoje 2027-01-05 (base 2027-02-04) → fevereiro tem dia 28", today: "2027-01-05", n: 2, day: 28, expected: ["2027-02-28", "2027-03-28"] },
    { name: "dia 5, hoje 2026-10-26 (base 2026-11-25) → mês seguinte", today: "2026-10-26", n: 2, day: 5, expected: ["2026-12-05", "2027-01-05"] },
    { name: "hoje 2026-01-31 sem dia → 2026-03-02, 2026-04-02", today: "2026-01-31", n: 2, day: null, expected: ["2026-03-02", "2026-04-02"] },
    { name: "dia igual ao da base → a própria base", today: "2026-10-26", n: 1, day: 25, expected: ["2026-11-25"] },
    { name: "base dia 30 sem dia → fevereiro vira o último dia", today: "2026-12-31", n: 3, day: null, expected: ["2027-01-30", "2027-02-28", "2027-03-30"] },
    { name: "virada de ano com dia escolhido", today: "2026-11-20", n: 3, day: 10, expected: ["2027-01-10", "2027-02-10", "2027-03-10"] },
  ];
  for (const c of cases) {
    test(c.name, () => assert.deepEqual(crediarioDueDates(c.today, c.n, c.day), c.expected));
  }

  test("'hoje' vem do fuso de São Paulo: 2026-10-27T02:30Z ainda é 26/10", () => {
    const today = todayInBusinessTz(new Date("2026-10-27T02:30:00.000Z"));
    assert.equal(today, "2026-10-26");
    assert.equal(crediarioDueDates(today, 1, null)[0], "2026-11-25");
  });

  test("entrada inválida → InternalInvariantError", () => {
    assert.throws(() => crediarioDueDates("2026-02-30", 1, null), InternalInvariantError);
    assert.throws(() => crediarioDueDates("26/10/2026", 1, null), InternalInvariantError);
    assert.throws(() => crediarioDueDates("2026-10-26", 0, null), InternalInvariantError);
    assert.throws(() => crediarioDueDates("2026-10-26", 1, 29), InternalInvariantError);
    assert.throws(() => crediarioDueDates("2026-10-26", 1, 0), InternalInvariantError);
  });
});
