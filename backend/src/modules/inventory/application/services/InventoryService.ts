import { Prisma } from "@prisma/client";

export interface ConsumeStockRequest {
  productVariantId: string;
  quantity: number;
  reason: string;
}

export interface InventoryService {
  consumeStock(
    request: ConsumeStockRequest,
    tx?: Prisma.TransactionClient,
  ): Promise<void>;
}
