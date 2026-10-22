// inventory/application/services/InventoryApplicationService.ts

import { RemoveInventory } from "../useCases/commands/DispatchInventoryUseCase";
import { ConsumeStockRequest, InventoryService } from "./InventoryService";

export class InventoryApplicationService implements InventoryService {
  constructor(private readonly consumeStockUseCase: RemoveInventory) {}
  async consumeStock(
    request: ConsumeStockRequest,
  ): Promise<void> {
    await this.consumeStockUseCase.execute(
      {
        productVariantId: request.productVariantId,
        quantity: request.quantity,
        reason: request.reason,
      }
    );
  }
}
