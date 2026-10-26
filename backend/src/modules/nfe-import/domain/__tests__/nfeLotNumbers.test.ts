import { test } from "node:test";
import assert from "node:assert/strict";
import { batchNumberCandidates, deliveryBatchNumber, MAX_BATCH_NUMBER_LENGTH } from "../nfeLotNumbers";

test("lote livre na variante → o número da nota", () => {
  assert.equal(deliveryBatchNumber("L001", "PC000042", new Set()), "L001");
  assert.equal(deliveryBatchNumber("L001", "PC000042", new Set(["L002"])), "L001");
});

test("lote já existente (outra entrega) → número + código do pedido", () => {
  assert.equal(deliveryBatchNumber("L001", "PC000042", new Set(["L001"])), "L001-PC000042");
});

test("número + código também em uso → sufixo sequencial único, nunca sem lote", () => {
  assert.equal(deliveryBatchNumber("L001", "PC000042", new Set(["L001", "L001-PC000042"])), "L001-PC000042-2");
  assert.equal(
    deliveryBatchNumber("L001", "PC000042", new Set(["L001", "L001-PC000042", "L001-PC000042-2", "L001-PC000042-3"])),
    "L001-PC000042-4",
  );
});

test("candidatos em ordem: número, depois número-pedido, depois -2, -3...", () => {
  assert.deepEqual(batchNumberCandidates("L001", "PC000042", 4), ["L001", "L001-PC000042", "L001-PC000042-2", "L001-PC000042-3"]);
});

test("número longo: corta o lote e mantém o sufixo com o código do pedido, no máximo 60 caracteres", () => {
  const long = "X".repeat(70);
  const result = deliveryBatchNumber(long, "PC000042", new Set([long]))!;
  assert.equal(result.length, MAX_BATCH_NUMBER_LENGTH);
  assert.ok(result.endsWith("-PC000042"));
  assert.equal(result, `${"X".repeat(60 - "-PC000042".length)}-PC000042`);
});

test("sufixo sequencial também cabe em 60 caracteres", () => {
  const long = "X".repeat(70);
  const taken = new Set([long, ...batchNumberCandidates(long, "PC000042", 3)]);
  const result = deliveryBatchNumber(long, "PC000042", taken);
  assert.equal(result, `${"X".repeat(60 - "-PC000042-3".length)}-PC000042-3`);
  assert.equal(result.length, MAX_BATCH_NUMBER_LENGTH);
});
