export interface InventoryBalanceDTO {
  productVariantId: string;
  quantity: number;
  reserved: number;
  available: number;
  /** Quantidade em lotes vencidos (validade anterior a hoje no fuso de negócio). */
  expired: number;
}
