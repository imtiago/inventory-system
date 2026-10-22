
export interface ConsumeStockRequest {
  productVariantId: string;
  quantity: number;
  reason: string;
}

export interface InventoryService {
  consumeStock(
    request: ConsumeStockRequest,
  ): Promise<void>;
}
