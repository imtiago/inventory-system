import { test } from "node:test";
import assert from "node:assert/strict";
import { parseBrMoneyToCents, parseBrDate, normalizePhone, parseDueDates } from "@legacy-import/domain/brParsers";

test("parseBrMoneyToCents", () => {
  const cases: [string, number | null][] = [
    ["1.234,56", 123456], ["39.9", 3990], ["1.000", 100000], ["R$ 12,50", 1250], ["R$12", 1200],
    ["1,234", null], ["-5", null], ["", null], ["abc", null], ["0", 0], ["10,5", 1050],
    ["1.234.567,89", 123456789], ["1.00.0", null], ["99999999999999,00", null], ["1.5.0", null],
  ];
  for (const [i, o] of cases) assert.equal(parseBrMoneyToCents(i), o, i);
});

test("parseBrDate", () => {
  const cases: [string, string | null][] = [
    ["5/3/2026", "2026-03-05"], ["05/03/2026", "2026-03-05"], ["31/02/2026", null], ["29/02/2024", "2024-02-29"],
    ["29/02/2026", null], ["2026-03-05", null], ["", null], ["1/13/2026", null], ["5/3/26", null],
  ];
  for (const [i, o] of cases) assert.equal(parseBrDate(i), o, i);
});

test("normalizePhone", () => {
  const cases: [string, string | null][] = [
    ["(11) 98888-7777", "11988887777"], ["+55 11 98888-7777", "11988887777"], ["9888", null],
    ["11 3888-7777", "1138887777"], ["5511988887777", "11988887777"], ["", null],
  ];
  for (const [i, o] of cases) assert.equal(normalizePhone(i), o, i);
});

test("parseDueDates", () => {
  assert.deepEqual(parseDueDates("10/11/2026=50,00; 10/12/2026=1.050,50"), [
    { date: "2026-11-10", amountCents: 5000 },
    { date: "2026-12-10", amountCents: 105050 },
  ]);
  assert.deepEqual(parseDueDates("10/11/2026=50,00;"), [{ date: "2026-11-10", amountCents: 5000 }]);
  for (const bad of ["", "10/11/2026", "31/02/2026=5", "10/11/2026=abc", "10/11/2026=0"]) {
    assert.equal(parseDueDates(bad), null, bad);
  }
});
