import { test } from "node:test";
import assert from "node:assert/strict";
import { RegisterScannedProductUseCase } from "../RegisterScannedProductUseCase";
import { AddProductToBoxUseCase } from "../AddProductToBoxUseCase";
import { ReceiveInventoryUseCase } from "../ReceiveInventoryUseCase";
import { InventoryBox } from "@inventory/domain/entities/InventoryBox";
import {
  FakeCatalogService,
  InMemoryInventoryBoxRepository,
  InMemoryInventoryBoxStockRepository,
  makeVariant,
} from "../../../__tests__/fakes";
import { setupStock, snapshot } from "./helpers";

async function build() {
  const s = setupStock();
  const catalog = new FakeCatalogService([makeVariant({ barcode: "789" })]);
  const boxes = new InMemoryInventoryBoxRepository();
  const stocks = new InMemoryInventoryBoxStockRepository();
  const receive = new ReceiveInventoryUseCase(catalog, s.inventories, s.lots, s.movements, s.tx);
  const add = new AddProductToBoxUseCase(boxes, stocks, s.lots, s.inventories, s.tx);
  const uc = new RegisterScannedProductUseCase(catalog, receive, add, s.inventories, boxes, s.tx);
  const box = await boxes.create(new InventoryBox({ code: "BX1" }));
  return { ...s, boxes, stocks, uc, box };
}

test("registerScanned recebe e coloca na caixa", async () => {
  const s = await build();
  const r = await s.uc.execute({ barcode: "789", boxCode: "BX1", quantity: 3, batchNumber: "L1", userId: "u1" });
  const lot = s.lots.all()[0];
  assert.deepEqual(r, { boxId: s.box.id, boxCode: "BX1", inventoryLotId: lot.id, quantity: 3 });
  assert.equal(lot.remainingQuantity, 3);
  assert.equal((await s.stocks.findStock(lot.id, s.box.id))!.quantity, 3);
  assert.equal((await s.inventories.findByProductVariantId("variant-1"))!.quantity, 3);
  assert.equal(s.movements.all().length, 1);
});

test("registerScanned sem unitCost usa custo médio atual", async () => {
  const s = await build();
  await s.addLot(10, 7);
  await s.uc.execute({ barcode: "789", boxCode: "BX1" });
  const inv = (await s.inventories.findByProductVariantId("variant-1"))!;
  assert.equal(inv.quantity, 11);
  assert.equal(inv.averageCost, 7);
  assert.ok(s.lots.all().some((l) => l.unitCost === 7 && l.remainingQuantity === 1));
});

test("registerScanned caixa inexistente falha sem receber", async () => {
  const s = await build();
  const before = await snapshot(s);
  await assert.rejects(s.uc.execute({ barcode: "789", boxCode: "NOPE", quantity: 2 }), { name: "NotFoundError", code: "BOX_NOT_FOUND" });
  assert.equal(await snapshot(s), before);
  await assert.rejects(s.uc.execute({ barcode: "000", boxCode: "BX1" }), { name: "NotFoundError", code: "VARIANT_NOT_FOUND" });
  await assert.rejects(s.uc.execute({ barcode: "789", boxCode: "BX1", quantity: 0 }), { name: "BusinessRuleError", code: "INVALID_QUANTITY" });
});
