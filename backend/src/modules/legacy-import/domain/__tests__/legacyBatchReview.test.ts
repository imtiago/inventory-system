import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyRaw, flagDuplicateDebts, hasUnresolvedDuplicate, reviewBatch, type ReviewRowInput } from "../legacyBatchReview";

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

// Tempo real, teto folgado (a suíte roda arquivos em paralelo): com o índice leva ~0,1-0,3 s; sem ele, ~3 s.
test("desempenho: 500 linhas (máximo do lote) × 5.000 clientes revisadas em menos de 2 s", () => {
  const first = ["Maria", "João", "Ana", "Carlos", "Paula", "Pedro", "Lucia", "José", "Marcos", "Rita", "Antonio", "Francisca", "Mateus", "Juliana", "Rafael"];
  const last = ["Silva", "Souza", "Santos", "Lima", "Costa", "Alves", "Rocha", "Dias", "Melo", "Cruz", "Pereira", "Ferreira", "Gomes", "Ribeiro", "Barbosa"];
  const mk = (i: number) => `${first[i % first.length]} ${last[Math.floor(i / 15) % 15]} ${last[(i * 7) % 15]}${i % 97}`;
  const customers = Array.from({ length: 5000 }, (_, i) => ({ id: `c${i}`, name: mk(i), phone: `1199${String(i).padStart(7, "0")}` }));
  const rows = Array.from({ length: 500 }, (_, i) =>
    row(`r${i}`, i + 2, mk(i * 13 + 5), { raw: { ...emptyRaw(), nome: mk(i * 13 + 5), valor_total: "10,00", celular: `1198${String(i).padStart(7, "0")}` } }),
  );
  const t0 = performance.now();
  const { summary } = reviewBatch(rows, customers, "2026-11-02");
  const ms = performance.now() - t0;
  assert.equal(summary.rows, 500);
  assert.ok(ms < 2000, `${ms.toFixed(0)} ms`);
});

test("dívida repetida: vale para o cliente de destino (vínculo direto ou pela linha-raiz), mesmo saldo; aceita fica com aviso resolvido", () => {
  const review = reviewBatch(
    [
      row("a", 2, "Ana Lima", { customerAction: { kind: "LINK", customerId: "c1" } }),
      row("b", 3, "Ana Lima", { customerAction: { kind: "SAME_AS_ROW", rowId: "a" }, acceptDuplicate: true }),
      row("c", 4, "Bia Melo", { customerAction: { kind: "LINK", customerId: "c1" }, raw: { ...emptyRaw(), nome: "Bia Melo", valor_total: "11,00", celular: "11988887777", data_compra: "01/01/2026" } }),
    ],
    [{ id: "c1", name: "Ana Lima", phone: null }],
    "2026-11-02",
  );
  const flagged = flagDuplicateDebts(review, [{ customerId: "c1", openCents: 1000, batchId: "abcdef12-0000", line: 9, financialDocumentId: "d1" }]);
  const [a, b, c] = flagged.rows;
  assert.ok(hasUnresolvedDuplicate(a));
  assert.equal(a.status, "WARNING");
  assert.match(a.issues.at(-1)!.message, /lote abcdef12, linha 9/);
  assert.ok(!hasUnresolvedDuplicate(b));
  assert.equal(b.issues.at(-1)!.details?.accepted, true);
  assert.ok(!c.issues.some((i) => i.code === "POSSIBLE_DUPLICATE_DEBT"));
  assert.equal(flagged.summary.warnings, review.summary.warnings + 2);
});
