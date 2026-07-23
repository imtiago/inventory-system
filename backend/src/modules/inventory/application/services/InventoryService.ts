export interface InventoryService {
  consumeStock(
    productVariantId: string,
    quantity: number,
    reason: string,
  ): Promise<void>;
}
