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

export interface InventoryService {
  consumeStock(request: ConsumeStockRequest): Promise<void>;
  /** Devolve aos lotes de origem tudo o que a venda consumiu. Exige transação do chamador para atomicidade. */
  returnSaleStock(request: ReturnSaleStockRequest): Promise<void>;
}
