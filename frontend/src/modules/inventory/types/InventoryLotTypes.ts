// src/modules/inventory/types/InventoryLotTypes.ts

export interface InventoryLot {
  id: string;
  productVariantId: string;
  batchNumber: string;
  createdAt: string;
  expirationDate: string;
}

export interface InventoryLotPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface InventoryLotListResponse {
  data: InventoryLot[];
  pagination: InventoryLotPagination;
}
