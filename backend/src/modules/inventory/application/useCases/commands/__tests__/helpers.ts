import { ReceiveInventoryUseCase } from "../ReceiveInventoryUseCase";
import { StockMovementOrigin } from "@inventory/domain/enums/StockMovementOrigin";
import { InventoryLotSource } from "@inventory/domain/enums/InventoryLotSource";
import { InMemoryTransactionManager } from "../../../../../../test/InMemoryTransactionManager";
import {
  FakeCatalogService,
  InMemoryInventoryBoxStockRepository,
  InMemoryInventoryLotRepository,
  InMemoryInventoryRepository,
  InMemoryStockMovementRepository,
  makeVariant,
} from "../../../__tests__/fakes";

export function setupStock() {
  const inventories = new InMemoryInventoryRepository();
  const lots = new InMemoryInventoryLotRepository();
  const movements = new InMemoryStockMovementRepository();
  // Alocações por caixa enxergam o saldo dos lotes (reconciliação após saídas).
  const stocks = new InMemoryInventoryBoxStockRepository(lots);
  const tx = new InMemoryTransactionManager();
  const receive = new ReceiveInventoryUseCase(
    new FakeCatalogService([makeVariant()]),
    inventories,
    lots,
    movements,
    tx,
  );
  const addLot = (quantity: number, unitCost = 5, extra: { expirationDate?: Date } = {}) =>
    receive.execute({
      productVariantId: "variant-1",
      quantity,
      unitCost,
      origin: StockMovementOrigin.PURCHASE,
      sourceType: InventoryLotSource.PURCHASE,
      ...extra,
    });
  return { inventories, lots, movements, stocks, tx, addLot };
}

export async function snapshot(s: ReturnType<typeof setupStock>) {
  const strip = (xs: object[]) => JSON.stringify(xs);
  return (
    strip(s.inventories.all()) + strip(s.lots.all()) + strip(s.movements.all()) + strip(s.stocks.all())
  );
}
