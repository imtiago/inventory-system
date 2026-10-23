export interface ConsumeStockRequest {
  productVariantId: string;
  quantity: number;
  originId?: string;
  /** Usuário responsável (auditoria da movimentação). */
  userId?: string;
}

export interface ReturnSaleStockRequest {
  saleId: string;
  /** Itens da venda; o total devolvido por variante tem de bater com eles. */
  items: { productVariantId: string; quantity: number }[];
  /** Usuário que cancelou (auditoria das movimentações RETURN). */
  userId?: string;
}

export interface ReceivePurchaseStockRequest {
  purchaseId: string;
  purchaseItemId: string;
  productVariantId: string;
  quantity: number;
  /** Custo unitário do item do pedido, em centavos. */
  unitCostCents: number;
  batchNumber?: string;
  manufacturingDate?: Date;
  expirationDate?: Date;
  /** Usuário que registrou o recebimento (auditoria da movimentação). */
  userId: string;
}

export interface InventoryService {
  consumeStock(request: ConsumeStockRequest): Promise<void>;
  /** Devolve aos lotes de origem tudo o que a venda consumiu. Exige transação do chamador para atomicidade. */
  returnSaleStock(request: ReturnSaleStockRequest): Promise<void>;
  /**
   * Entrada de estoque de um item de compra: lote PURCHASE ligado ao item
   * (sourceId = pedido) e movimentação IN origem PURCHASE. Trava a linha de
   * inventário da variante; exige transação do chamador para atomicidade.
   * Lote com o mesmo número de outra origem/item → 409 BATCH_ALREADY_EXISTS.
   */
  receivePurchaseStock(request: ReceivePurchaseStockRequest): Promise<void>;
}
