import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BoxAllocation,
  planBoxAllocationReduction,
} from "@inventory/domain/services/boxAllocations";

const at = (minute: number) => new Date(Date.UTC(2026, 0, 1, 0, minute));
const alloc = (id: string, inventoryLotId: string, quantity: number, minute: number): BoxAllocation => ({
  id,
  inventoryLotId,
  boxId: `box-${id}`,
  quantity,
  createdAt: at(minute),
});

test("dentro do saldo: nenhuma mudança", () => {
  const changes = planBoxAllocationReduction(
    [alloc("a", "L1", 3, 1), alloc("b", "L1", 2, 2)],
    new Map([["L1", 5]]),
  );
  assert.deepEqual(changes, []);
});

test("abate das mais antigas primeiro (createdAt), zerando e depois reduzindo", () => {
  const changes = planBoxAllocationReduction(
    // fora de ordem de propósito: o planejador ordena
    [alloc("new", "L1", 4, 9), alloc("old", "L1", 3, 1), alloc("mid", "L1", 5, 5)],
    new Map([["L1", 7]]),
  );
  // Σ = 12, saldo 7 → excesso 5: old 3→0, mid 5→3, new intacta
  assert.deepEqual(changes, [
    { id: "old", inventoryLotId: "L1", boxId: "box-old", previousQuantity: 3, quantity: 0 },
    { id: "mid", inventoryLotId: "L1", boxId: "box-mid", previousQuantity: 5, quantity: 3 },
  ]);
});

test("empate em createdAt: desempata por id", () => {
  const changes = planBoxAllocationReduction(
    [alloc("b", "L1", 2, 1), alloc("a", "L1", 2, 1)],
    new Map([["L1", 3]]),
  );
  assert.deepEqual(changes, [
    { id: "a", inventoryLotId: "L1", boxId: "box-a", previousQuantity: 2, quantity: 1 },
  ]);
});

test("saldo zero apaga todas; lotes independentes", () => {
  const changes = planBoxAllocationReduction(
    [alloc("a", "L1", 2, 1), alloc("b", "L1", 1, 2), alloc("c", "L2", 4, 1)],
    new Map([
      ["L1", 0],
      ["L2", 4],
    ]),
  );
  assert.deepEqual(
    changes.map((c) => [c.id, c.quantity]),
    [
      ["a", 0],
      ["b", 0],
    ],
  );
});

test("lote sem saldo informado é tratado como saldo zero", () => {
  const changes = planBoxAllocationReduction([alloc("a", "L9", 2, 1)], new Map());
  assert.deepEqual(changes.map((c) => [c.id, c.quantity]), [["a", 0]]);
});
