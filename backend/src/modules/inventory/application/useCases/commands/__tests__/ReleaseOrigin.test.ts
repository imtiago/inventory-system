import { test } from "node:test";
import assert from "node:assert/strict";
import { ReserveInventoryUseCase } from "../ReserveInventoryUseCase";
import { ReleaseInventoryUseCase } from "../ReleaseInventoryUseCase";
import { StockMovementOrigin } from "@inventory/domain/enums/StockMovementOrigin";
import { setupStock, snapshot } from "./helpers";

function build() {
  const s = setupStock();
  return {
    ...s,
    reserve: new ReserveInventoryUseCase(s.inventories, s.movements, s.tx),
    release: new ReleaseInventoryUseCase(s.inventories, s.movements, s.tx),
  };
}

const MESSAGE = "A liberação excede o reservado por este documento.";

test("reserva grava a origem informada (não SALE por padrão)", async () => {
  const s = build();
  await s.addLot(10);
  const m = await s.reserve.execute({
    productVariantId: "variant-1",
    quantity: 2,
    origin: StockMovementOrigin.TRANSFER,
    originId: "doc-1",
  });
  assert.equal(m.origin, StockMovementOrigin.TRANSFER);
});

test("liberação acima do reservado por aquele documento → 409 RELEASE_EXCEEDS_RESERVATION, mesmo com reserva de outro documento", async () => {
  const s = build();
  const { inventory } = await s.addLot(10);
  const sale = StockMovementOrigin.SALE;
  await s.reserve.execute({ productVariantId: "variant-1", quantity: 2, origin: sale, originId: "doc-A" });
  await s.reserve.execute({ productVariantId: "variant-1", quantity: 5, origin: sale, originId: "doc-B" });
  const before = await snapshot(s);
  await assert.rejects(
    s.release.execute({ inventoryId: inventory.id, quantity: 3, origin: sale, originId: "doc-A" }),
    { name: "ConflictError", code: "RELEASE_EXCEEDS_RESERVATION", message: MESSAGE },
  );
  assert.equal(await snapshot(s), before);
});

test("liberação soma RESERVE − RELEASE do documento e grava origem/originId", async () => {
  const s = build();
  const { inventory } = await s.addLot(10);
  const sale = StockMovementOrigin.SALE;
  await s.reserve.execute({ productVariantId: "variant-1", quantity: 4, origin: sale, originId: "doc-A" });
  const m = await s.release.execute({ inventoryId: inventory.id, quantity: 3, origin: sale, originId: "doc-A" });
  assert.equal(m.origin, sale);
  assert.equal(m.originId, "doc-A");
  await assert.rejects(
    s.release.execute({ inventoryId: inventory.id, quantity: 2, origin: sale, originId: "doc-A" }),
    { code: "RELEASE_EXCEEDS_RESERVATION" },
  );
  await s.release.execute({ inventoryId: inventory.id, quantity: 1, origin: sale, originId: "doc-A" });
  assert.equal((await s.inventories.findById(inventory.id))!.reservedQuantity, 0);
});

test("origem diferente com mesmo originId não conta", async () => {
  const s = build();
  const { inventory } = await s.addLot(10);
  await s.reserve.execute({ productVariantId: "variant-1", quantity: 4, origin: StockMovementOrigin.SALE, originId: "doc-A" });
  await assert.rejects(
    s.release.execute({ inventoryId: inventory.id, quantity: 1, origin: StockMovementOrigin.TRANSFER, originId: "doc-A" }),
    { code: "RELEASE_EXCEEDS_RESERVATION" },
  );
});
