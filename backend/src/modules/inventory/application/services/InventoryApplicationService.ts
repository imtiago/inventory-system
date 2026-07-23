// inventory/application/services/InventoryApplicationService.ts

import { Prisma } from "@prisma/client";
import { RemoveInventory } from "../useCases/RemoveInventory";
import { InventoryService } from "./InventoryService";

export class InventoryApplicationService implements InventoryService {
  constructor(private readonly consumeStockUseCase: RemoveInventory) {}

  async consumeStock(
    productVariantId: string,
    quantity: number,
    reason: string,
  ): Promise<void> {
    await this.consumeStockUseCase.execute(productVariantId, quantity, reason);
  }
}
