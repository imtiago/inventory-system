import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyRaw, reviewBatch, type ReviewRowInput } from "../legacyBatchReview";

const row = (id: string, line: number, nome: string, extra: Partial<ReviewRowInput> = {}): ReviewRowInput => ({
  id,
  line,
  raw: { ...emptyRaw(), nome, valor_total: "10,00", celular: "11988887777", data_compra: "01/01/2026" },
  ignored: false,
  customerAction: { kind: "NEW" },
  ...extra,
});

test("ciclo e alvo ignorado em SAME_AS_ROW voltam para NEW (sem travar)", () => {
  const { rows } = reviewBatch(
    [
      row("a", 2, "Ana Lima", { customerAction: { kind: "SAME_AS_ROW", rowId: "b" } }),
      row("b", 3, "Bia Lima", { customerAction: { kind: "SAME_AS_ROW", rowId: "a" } }),
      row("c", 4, "Cia Lima", { customerAction: { kind: "SAME_AS_ROW", rowId: "d" } }),
      row("d", 5, "Dia Lima", { ignored: true }),
    ],
    [],
    "2026-11-02",
  );
  assert.deepEqual(rows.map((r) => r.customerAction.kind), ["NEW", "NEW", "NEW", "NEW"]);
});

test("100 linhas × 200 clientes revisadas em menos de 200 ms", () => {
  const customers = Array.from({ length: 200 }, (_, i) => ({ id: `c${i}`, name: `Cliente Numero${i}x Sobrenome`, phone: null }));
  const rows = Array.from({ length: 100 }, (_, i) => row(`r${i}`, i + 2, `Pessoa Teste${i}y Nome`));
  const t0 = performance.now();
  const { summary } = reviewBatch(rows, customers, "2026-11-02");
  assert.ok(performance.now() - t0 < 200);
  assert.equal(summary.rows, 100);
});
