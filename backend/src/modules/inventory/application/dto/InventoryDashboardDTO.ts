export interface InventoryDashboardDTO {
  totalProducts: number;
  totalQuantity: number;
  totalReserved: number;
  totalAvailable: number;
  lowStock: number;
  outOfStock: number;
  totalStockValue: number;
}
