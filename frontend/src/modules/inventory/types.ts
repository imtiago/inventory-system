export interface IInventoryProductVariant {
  id: string;
  name: string;
  barcode: string | null;
  code: string;
  productId: string;
  createdAt: string;
}

export interface IInventory {
  id: string;
  availableQuantity: number;
  createdAt: string;
  minimumStock: number;
  productVariantId: string;
  productVariant: IInventoryProductVariant;
  quantity: number;
  reservedQuantity: number;
}

export interface IInventoryPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface IInventoryListResponse {
  data: IInventory[];
  pagination: IInventoryPagination;
}
