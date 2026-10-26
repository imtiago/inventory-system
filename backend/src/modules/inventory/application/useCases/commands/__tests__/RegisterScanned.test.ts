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

test("3 leituras sem lote na mesma caixa somam num único lote aberto CONT-<caixa>-<variante>", async () => {
  const s = await build();
  for (let i = 0; i < 3; i++) await s.uc.execute({ barcode: "789", boxCode: "BX1" });
  assert.equal(s.lots.all().length, 1);
  const lot = s.lots.all()[0];
  assert.equal(lot.batchNumber, "CONT-BX1-V1");
  assert.equal(lot.sourceType, "MANUAL");
  assert.equal(lot.initialQuantity, 3);
  assert.equal(lot.remainingQuantity, 3);
  assert.equal((await s.stocks.findStock(lot.id, s.box.id))!.quantity, 3);
  assert.equal(s.movements.all().length, 3);
});

test("leituras sem lote em caixas diferentes geram um lote aberto por caixa", async () => {
  const s = await build();
  await s.boxes.create(new InventoryBox({ code: "BX2" }));
  await s.uc.execute({ barcode: "789", boxCode: "BX1" });
  await s.uc.execute({ barcode: "789", boxCode: "BX2" });
  await s.uc.execute({ barcode: "789", boxCode: "BX2" });
  assert.deepEqual(
    s.lots.all().map((l) => [l.batchNumber, l.remainingQuantity]).sort(),
    [["CONT-BX1-V1", 1], ["CONT-BX2-V1", 2]],
  );
});

test("com lote informado continua usando o lote do usuário", async () => {
  const s = await build();
  await s.uc.execute({ barcode: "789", boxCode: "BX1", batchNumber: "L9" });
  await s.uc.execute({ barcode: "789", boxCode: "BX1" });
  assert.deepEqual(s.lots.all().map((l) => l.batchNumber).sort(), ["CONT-BX1-V1", "L9"]);
});

test("leituras com validades diferentes na mesma caixa geram um lote por validade, sem 409", async () => {
  const s = await build();
  const d1 = new Date("2026-11-10T00:00:00.000Z");
  const d2 = new Date("2026-11-20T00:00:00.000Z");
  await s.uc.execute({ barcode: "789", boxCode: "BX1", expirationDate: d1 });
  await s.uc.execute({ barcode: "789", boxCode: "BX1", expirationDate: d2 });
  await s.uc.execute({ barcode: "789", boxCode: "BX1", expirationDate: d1 });
  assert.deepEqual(
    s.lots.all().map((l) => [l.batchNumber, l.remainingQuantity]).sort(),
    [["CONT-BX1-V1-20261110", 2], ["CONT-BX1-V1-20261120", 1]],
  );
});

test("leitura sem validade e depois com validade: dois lotes; o sem validade continua sem data", async () => {
  const s = await build();
  await s.uc.execute({ barcode: "789", boxCode: "BX1" });
  await s.uc.execute({ barcode: "789", boxCode: "BX1", expirationDate: new Date("2026-11-10T00:00:00.000Z") });
  await s.uc.execute({ barcode: "789", boxCode: "BX1" });
  const undated = s.lots.all().find((l) => l.batchNumber === "CONT-BX1-V1")!;
  assert.equal(s.lots.all().length, 2);
  assert.ok(!undated.expirationDate);
  assert.equal(undated.remainingQuantity, 2);
  assert.ok(s.lots.all().some((l) => l.batchNumber === "CONT-BX1-V1-20261110" && l.remainingQuantity === 1));
});
