import { fromCents } from "@shared/domain/money";
import { InventoryLotSource } from "@inventory/domain/enums/InventoryLotSource";
import { StockMovementOrigin } from "@inventory/domain/enums/StockMovementOrigin";
import { DispatchInventoryUseCase } from "../useCases/commands/DispatchInventoryUseCase";
import { ReceiveInventoryUseCase } from "../useCases/commands/ReceiveInventoryUseCase";
import { ReturnSaleStockUseCase } from "../useCases/commands/ReturnSaleStockUseCase";
import {
  ConsumeStockRequest,
  InventoryService,
  ReceivePurchaseStockRequest,
  ReturnSaleStockRequest,
} from "./InventoryService";

export class InventoryApplicationService implements InventoryService {
  constructor(
    private readonly dispatchInventoryUseCase: Pick<DispatchInventoryUseCase, "execute">,
    private readonly returnSaleStockUseCase: Pick<ReturnSaleStockUseCase, "execute">,
    private readonly receiveInventoryUseCase: Pick<ReceiveInventoryUseCase, "execute">,
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
      items: request.items,
    });
  }

  async receivePurchaseStock(request: ReceivePurchaseStockRequest): Promise<void> {
    await this.receiveInventoryUseCase.execute({
      productVariantId: request.productVariantId,
      quantity: request.quantity,
      unitCost: fromCents(request.unitCostCents),
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
