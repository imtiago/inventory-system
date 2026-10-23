import { StockMovementOrigin } from "@inventory/domain/enums/StockMovementOrigin";
import { DispatchInventoryUseCase } from "../useCases/commands/DispatchInventoryUseCase";
import { ReturnSaleStockUseCase } from "../useCases/commands/ReturnSaleStockUseCase";
import { ConsumeStockRequest, InventoryService, ReturnSaleStockRequest } from "./InventoryService";

export class InventoryApplicationService implements InventoryService {
  constructor(
    private readonly dispatchInventoryUseCase: Pick<DispatchInventoryUseCase, "execute">,
    private readonly returnSaleStockUseCase: Pick<ReturnSaleStockUseCase, "execute">,
  ) {}

  async consumeStock(request: ConsumeStockRequest): Promise<void> {
    await this.dispatchInventoryUseCase.execute({
      productVariantId: request.productVariantId,
      quantity: request.quantity,
      origin: StockMovementOrigin.SALE,
      originReferenceId: request.originId,
      userId: request.userId,
    });
  }

  async returnSaleStock(request: ReturnSaleStockRequest): Promise<void> {
    await this.returnSaleStockUseCase.execute({
      saleId: request.saleId,
      userId: request.userId,
    });
  }
}
