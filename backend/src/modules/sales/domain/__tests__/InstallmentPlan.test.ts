import { test } from "node:test";
import assert from "node:assert/strict";
import { buildInstallments } from "../services/InstallmentPlan";

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);
const iso = (date: Date) => date.toISOString().slice(0, 10);

test("1x → uma parcela = total, vencimento = data informada", () => {
  const plan = buildInstallments(12345, 1, d("2026-11-15"));
  assert.equal(plan.length, 1);
  assert.equal(plan[0].amountCents, 12345);
  assert.equal(iso(plan[0].dueDate), "2026-11-15");
});

test("10000 em 3x → [3333, 3333, 3334]; 5 em 3x → [1, 1, 3]", () => {
  assert.deepEqual(
    buildInstallments(10000, 3, d("2026-11-15")).map((p) => p.amountCents),
    [3333, 3333, 3334],
  );
  assert.deepEqual(
    buildInstallments(5, 3, d("2026-11-15")).map((p) => p.amountCents),
    [1, 1, 3],
  );
});

test("soma das parcelas é exatamente o total", () => {
  for (const [total, n] of [[99999, 7], [1, 1], [100, 12], [123457, 11]]) {
    const plan = buildInstallments(total, n, d("2026-11-15"));
    assert.equal(plan.length, n);
    assert.equal(plan.reduce((s, p) => s + p.amountCents, 0), total);
  }
});

test("vencimentos mensais no mesmo dia do mês", () => {
  assert.deepEqual(
    buildInstallments(300, 3, d("2026-11-15")).map((p) => iso(p.dueDate)),
    ["2026-11-15", "2026-12-15", "2027-01-15"],
  );
});

test("primeiro vencimento 31/01 → 28/02 (ou 29/02 bissexto) e 31/03", () => {
  assert.deepEqual(
    buildInstallments(300, 3, d("2027-01-31")).map((p) => iso(p.dueDate)),
    ["2027-01-31", "2027-02-28", "2027-03-31"],
  );
  assert.deepEqual(
    buildInstallments(400, 4, d("2028-01-31")).map((p) => iso(p.dueDate)),
    ["2028-01-31", "2028-02-29", "2028-03-31", "2028-04-30"],
  );
});

test("parâmetros inválidos lançam", () => {
  assert.throws(() => buildInstallments(100, 0, d("2026-11-15")));
  assert.throws(() => buildInstallments(10.5, 2, d("2026-11-15")));
  assert.throws(() => buildInstallments(-1, 2, d("2026-11-15")));
});
