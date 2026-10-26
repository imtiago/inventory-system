import { InventoryLotSource } from "@inventory/domain/enums/InventoryLotSource";
import { StockMovementOrigin } from "@inventory/domain/enums/StockMovementOrigin";
import { DispatchInventoryUseCase } from "../useCases/commands/DispatchInventoryUseCase";
import { ReceiveInventoryUseCase } from "../useCases/commands/ReceiveInventoryUseCase";
import { ReturnSaleStockUseCase } from "../useCases/commands/ReturnSaleStockUseCase";
import { RevertPurchaseStockUseCase } from "../useCases/commands/RevertPurchaseStockUseCase";
import {
  ConsumeStockRequest,
  InventoryService,
  ReceivePurchaseStockRequest,
  ReturnSaleStockRequest,
  RevertPurchaseStockRequest,
} from "./InventoryService";

export class InventoryApplicationService implements InventoryService {
  constructor(
    private readonly dispatchInventoryUseCase: Pick<DispatchInventoryUseCase, "execute">,
    private readonly returnSaleStockUseCase: Pick<ReturnSaleStockUseCase, "execute">,
    private readonly receiveInventoryUseCase: Pick<ReceiveInventoryUseCase, "execute">,
    private readonly revertPurchaseStockUseCase: Pick<RevertPurchaseStockUseCase, "execute">,
  ) {}

  async revertPurchaseStock(request: RevertPurchaseStockRequest): Promise<"REVERTED" | "STOCK_USED"> {
    return (await this.revertPurchaseStockUseCase.execute(request)).status;
  }

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
      items: request.items,
    });
  }

  async receivePurchaseStock(request: ReceivePurchaseStockRequest): Promise<void> {
    await this.receiveInventoryUseCase.execute({
      productVariantId: request.productVariantId,
      quantity: request.quantity,
      unitCost: request.unitCost,
      batchNumber: request.batchNumber,
      manufacturingDate: request.manufacturingDate,
      expirationDate: request.expirationDate,
      origin: StockMovementOrigin.PURCHASE,
      sourceType: InventoryLotSource.PURCHASE,
      originReferenceId: request.purchaseId,
      purchaseItemId: request.purchaseItemId,
      userId: request.userId,
    });
  }
}
