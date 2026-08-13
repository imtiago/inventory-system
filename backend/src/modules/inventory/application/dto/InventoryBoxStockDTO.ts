export interface InventoryBoxStockDTO {
  id?: string;
  inventoryLotId: string;
  boxId: string;
  quantity: number;
  createdAt?: Date;
  updatedAt?: Date;
}