import { StockMovementOrigin } from "@inventory/domain/enums/StockMovementOrigin";
import { DispatchInventoryUseCase } from "../useCases/commands/DispatchInventoryUseCase";
import { ConsumeStockRequest, InventoryService } from "./InventoryService";

export class InventoryApplicationService implements InventoryService {
  constructor(
    private readonly dispatchInventoryUseCase: Pick<
      DispatchInventoryUseCase,
      "execute"
    >,
  ) {}

  async consumeStock(request: ConsumeStockRequest): Promise<void> {
    await this.dispatchInventoryUseCase.execute({
      productVariantId: request.productVariantId,
      quantity: request.quantity,
      origin: StockMovementOrigin.SALE,
      originReferenceId: request.originId,
    });
  }
}
