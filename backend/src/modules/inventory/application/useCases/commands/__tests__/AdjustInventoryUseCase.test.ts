import { test } from "node:test";
import assert from "node:assert/strict";
import { AdjustInventoryUseCase } from "../AdjustInventoryUseCase";
import { StockMovementOrigin } from "@inventory/domain/enums/StockMovementOrigin";
import { StockMovementType } from "@inventory/domain/enums/StockMovementType";
import { InventoryLotSource } from "@inventory/domain/enums/InventoryLotSource";
import { InternalInvariantError } from "@shared/domain/errors";
import { ReserveInventoryUseCase } from "../ReserveInventoryUseCase";
import { ReleaseInventoryUseCase } from "../ReleaseInventoryUseCase";
import { setupStock, snapshot } from "./helpers";

function build() {
  const s = setupStock();
  return { ...s, adjust: new AdjustInventoryUseCase(s.inventories, s.lots, s.movements, s.stocks, s.tx) };
}

test("adjust sem diferença retorna null e não grava", async () => {
  const s = build();
  await s.addLot(10);
  const before = await snapshot(s);
  const r = await s.adjust.execute({ productVariantId: "variant-1", countedQuantity: 10 });
  assert.equal(r, null);
  assert.equal(await snapshot(s), before);
});

test("adjust para baixo consome FIFO e registra ADJUSTMENT q=|diff|", async () => {
  const s = build();
  const a = await s.addLot(3);
  const b = await s.addLot(5);
  const m = await s.adjust.execute({ productVariantId: "variant-1", countedQuantity: 4, userId: "u1", notes: "contagem" });
  assert.equal((await s.lots.findById(a.lot.id))!.remainingQuantity, 0);
  assert.equal((await s.lots.findById(b.lot.id))!.remainingQuantity, 4);
  assert.equal((await s.inventories.findById(a.inventory.id))!.quantity, 4);
  assert.ok(m);
  assert.equal(m.type, StockMovementType.ADJUSTMENT);
  assert.equal(m.origin, StockMovementOrigin.INVENTORY);
  assert.equal(m.quantity, 4);
  assert.equal(m.previousQuantity, 8);
  assert.equal(m.currentQuantity, 4);
  assert.equal(m.inventoryLotId, null);
  assert.equal(m.averageCost, 5);
  assert.equal(m.userId, "u1");
  assert.equal(m.notes, "contagem");
});

test("adjust para cima cria lote MANUAL com custo médio atual", async () => {
  const s = build();
  await s.addLot(10, 5);
  await s.addLot(10, 15); // média 10
  const m = await s.adjust.execute({ productVariantId: "variant-1", countedQuantity: 25 });
  const manual = s.lots.all().find((l) => l.sourceType === InventoryLotSource.MANUAL)!;
  assert.ok(manual);
  assert.equal(manual.initialQuantity, 5);
  assert.equal(manual.remainingQuantity, 5);
  assert.equal(manual.unitCost, 10);
  const inv = (await s.inventories.findByProductVariantId("variant-1"))!;
  assert.equal(inv.quantity, 25);
  assert.equal(inv.averageCost, 10);
  assert.equal(m!.type, StockMovementType.ADJUSTMENT);
  assert.equal(m!.quantity, 5);
  assert.equal(m!.previousQuantity, 20);
  assert.equal(m!.currentQuantity, 25);
  assert.equal(m!.inventoryLotId, manual.id);
});

test("adjust com contagem negativa ou sem inventário falha sem gravar", async () => {
  const s = build();
  await assert.rejects(() => s.adjust.execute({ productVariantId: "variant-1", countedQuantity: 1 }), {
    name: "NotFoundError", code: "INVENTORY_NOT_FOUND",
  });
  await s.addLot(5);
  const before = await snapshot(s);
  await assert.rejects(() => s.adjust.execute({ productVariantId: "variant-1", countedQuantity: -1 }), { code: "INVALID_QUANTITY" });
  assert.equal(await snapshot(s), before);
});

test("adjust com lotes inconsistentes lança InternalInvariantError", async () => {
  const s = build();
  const { lot } = await s.addLot(5);
  lot.consume(5); // saldo do estoque diverge dos lotes
  await s.lots.update(lot);
  await assert.rejects(
    () => s.adjust.execute({ productVariantId: "variant-1", countedQuantity: 1 }),
    InternalInvariantError,
  );
});

test("adjust para baixo consome em FEFO (vencido primeiro), mesmo que criado depois", async () => {
  const s = build();
  const valid = await s.addLot(3);
  const expired = await s.addLot(2, 5, { expirationDate: new Date("2020-01-01T00:00:00Z") });
  await s.adjust.execute({ productVariantId: "variant-1", countedQuantity: 3 });
  assert.equal((await s.lots.findById(expired.lot.id))!.remainingQuantity, 0);
  assert.equal((await s.lots.findById(valid.lot.id))!.remainingQuantity, 3);
});

function buildWithReserve() {
  const s = build();
  return {
    ...s,
    reserve: new ReserveInventoryUseCase(s.inventories, s.movements, s.tx),
    release: new ReleaseInventoryUseCase(s.inventories, s.movements, s.tx),
  };
}

test("adjust abaixo do reservado → 409 ADJUST_BELOW_RESERVED listando os documentos, sem gravar", async () => {
  const s = buildWithReserve();
  await s.addLot(10);
  await s.reserve.execute({ productVariantId: "variant-1", quantity: 3, origin: StockMovementOrigin.SALE, originId: "sale-A" });
  await s.reserve.execute({ productVariantId: "variant-1", quantity: 2, origin: StockMovementOrigin.SALE, originId: "sale-B" });
  const before = await snapshot(s);
  await assert.rejects(() => s.adjust.execute({ productVariantId: "variant-1", countedQuantity: 4 }), (e: any) => {
    assert.equal(e.name, "ConflictError");
    assert.equal(e.code, "ADJUST_BELOW_RESERVED");
    assert.equal(
      e.message,
      "Há 5 unidade(s) reservada(s) para: Venda #SALE-A (3), Venda #SALE-B (2). Libere as reservas antes de ajustar abaixo disso.",
    );
    return true;
  });
  assert.equal(await snapshot(s), before);
});

test("documento já liberado não aparece; ajuste exatamente no reservado é aceito", async () => {
  const s = buildWithReserve();
  await s.addLot(10);
  await s.reserve.execute({ productVariantId: "variant-1", quantity: 3, origin: StockMovementOrigin.SALE, originId: "sale-A" });
  await s.reserve.execute({ productVariantId: "variant-1", quantity: 2, origin: StockMovementOrigin.SALE, originId: "sale-B" });
  await s.release.execute({ inventoryId: (await s.inventories.findByProductVariantId("variant-1"))!.id, quantity: 3, origin: StockMovementOrigin.SALE, originId: "sale-A" });
  await assert.rejects(() => s.adjust.execute({ productVariantId: "variant-1", countedQuantity: 1 }), (e: any) => {
    assert.equal(e.code, "ADJUST_BELOW_RESERVED");
    assert.equal(e.message, "Há 2 unidade(s) reservada(s) para: Venda #SALE-B (2). Libere as reservas antes de ajustar abaixo disso.");
    return true;
  });
  const m = await s.adjust.execute({ productVariantId: "variant-1", countedQuantity: 2 });
  assert.ok(m);
  assert.equal((await s.inventories.findByProductVariantId("variant-1"))!.reservedQuantity, 2);
});

test("a movimentação de ajuste guarda o reservado anterior nas notas", async () => {
  const s = buildWithReserve();
  await s.addLot(10);
  await s.reserve.execute({ productVariantId: "variant-1", quantity: 3, origin: StockMovementOrigin.SALE, originId: "sale-A" });
  const m = await s.adjust.execute({ productVariantId: "variant-1", countedQuantity: 6, notes: "contagem" });
  assert.equal(m!.notes, "contagem (reservado: 3)");
  const n = await s.adjust.execute({ productVariantId: "variant-1", countedQuantity: 8 });
  assert.equal(n!.notes, "Reservado: 3");
});

test("documentos de compra mostram o código do pedido; origem sem documento usa o id curto", async () => {
  const s = build();
  const adjust = new AdjustInventoryUseCase(s.inventories, s.lots, s.movements, s.stocks, s.tx, async (id) => (id === "purchase-uuid-1" ? "PC-0007" : null));
  const reserve = new ReserveInventoryUseCase(s.inventories, s.movements, s.tx);
  await s.addLot(10);
  await reserve.execute({ productVariantId: "variant-1", quantity: 2, origin: StockMovementOrigin.PURCHASE, originId: "purchase-uuid-1" });
  await reserve.execute({ productVariantId: "variant-1", quantity: 1, origin: StockMovementOrigin.TRANSFER, originId: "abcdef12-3456-7890" });
  await assert.rejects(() => adjust.execute({ productVariantId: "variant-1", countedQuantity: 1 }), (e: any) => {
    assert.equal(
      e.message,
      "Há 3 unidade(s) reservada(s) para: Pedido PC-0007 (2), TRANSFER ABCDEF12 (1). Libere as reservas antes de ajustar abaixo disso.",
    );
    return true;
  });
});
