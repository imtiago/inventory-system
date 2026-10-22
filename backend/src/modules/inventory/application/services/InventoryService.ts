export interface ConsumeStockRequest {
  productVariantId: string;
  quantity: number;
  originId?: string;
}

export interface InventoryService {
  consumeStock(request: ConsumeStockRequest): Promise<void>;
}
