/**
 * Invariante do estoque em caixas (onda 1 §5): para cada lote,
 * Σ InventoryBoxStock.quantity ≤ InventoryLot.remainingQuantity.
 */
export interface BoxAllocation {
  id: string;
  inventoryLotId: string;
  boxId: string;
  quantity: number;
  createdAt: Date;
}

/** Alocação reduzida: `quantity` é o novo valor (0 → a linha é apagada). */
export interface BoxAllocationChange {
  id: string;
  inventoryLotId: string;
  boxId: string;
  previousQuantity: number;
  quantity: number;
}

const byAge = (a: BoxAllocation, b: BoxAllocation) =>
  a.createdAt.getTime() - b.createdAt.getTime() || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/**
 * Quando a soma das alocações de um lote passa do saldo, abate o excesso das
 * alocações mais antigas primeiro (`createdAt`, depois `id`). Lote sem saldo
 * informado conta como saldo 0. Devolve só as alocações que mudam.
 */
export function planBoxAllocationReduction(
  allocations: readonly BoxAllocation[],
  remainingByLot: ReadonlyMap<string, number>,
): BoxAllocationChange[] {
  const byLot = new Map<string, BoxAllocation[]>();
  for (const allocation of allocations) {
    const list = byLot.get(allocation.inventoryLotId) ?? [];
    list.push(allocation);
    byLot.set(allocation.inventoryLotId, list);
  }

  const changes: BoxAllocationChange[] = [];
  for (const [lotId, list] of byLot) {
    const allocated = list.reduce((sum, a) => sum + a.quantity, 0);
    let excess = allocated - Math.max(0, remainingByLot.get(lotId) ?? 0);
    if (excess <= 0) continue;

    for (const allocation of [...list].sort(byAge)) {
      if (excess <= 0) break;
      const cut = Math.min(excess, allocation.quantity);
      if (cut <= 0) continue;
      changes.push({
        id: allocation.id,
        inventoryLotId: allocation.inventoryLotId,
        boxId: allocation.boxId,
        previousQuantity: allocation.quantity,
        quantity: allocation.quantity - cut,
      });
      excess -= cut;
    }
  }
  return changes;
}
