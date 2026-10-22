import { ReceiveInventoryUseCase } from "../ReceiveInventoryUseCase";
import { StockMovementOrigin } from "@inventory/domain/enums/StockMovementOrigin";
import { InventoryLotSource } from "@inventory/domain/enums/InventoryLotSource";
import { InMemoryTransactionManager } from "@shared/application/transaction/InMemoryTransactionManager";
import {
  FakeCatalogService,
  InMemoryInventoryLotRepository,
  InMemoryInventoryRepository,
  InMemoryStockMovementRepository,
  makeVariant,
} from "../../../__tests__/fakes";

export function setupStock() {
  const inventories = new InMemoryInventoryRepository();
  const lots = new InMemoryInventoryLotRepository();
  const movements = new InMemoryStockMovementRepository();
  const tx = new InMemoryTransactionManager();
  const receive = new ReceiveInventoryUseCase(
    new FakeCatalogService([makeVariant()]),
    inventories,
    lots,
    movements,
    tx,
  );
  const addLot = (quantity: number, unitCost = 5) =>
    receive.execute({
      productVariantId: "variant-1",
      quantity,
      unitCost,
      origin: StockMovementOrigin.PURCHASE,
      sourceType: InventoryLotSource.PURCHASE,
    });
  return { inventories, lots, movements, tx, addLot };
}

export async function snapshot(s: ReturnType<typeof setupStock>) {
  const strip = (xs: object[]) => JSON.stringify(xs);
  return strip(s.inventories.all()) + strip(s.lots.all()) + strip(s.movements.all());
}
