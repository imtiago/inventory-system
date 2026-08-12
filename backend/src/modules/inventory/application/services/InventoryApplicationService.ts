// inventory/application/services/InventoryApplicationService.ts

import { Prisma } from "@prisma/client";
import { RemoveInventory } from "../useCases/DispatchInventoryUseCase";
import { ConsumeStockRequest, InventoryService } from "./InventoryService";

export class InventoryApplicationService implements InventoryService {
  constructor(private readonly consumeStockUseCase: RemoveInventory) {}
  async consumeStock(
    request: ConsumeStockRequest,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    await this.consumeStockUseCase.execute(
      {
        productVariantId: request.productVariantId,
        quantity: request.quantity,
        reason: request.reason,
      },
      tx,
    );
  }
}
