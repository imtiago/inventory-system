import { InventoryBoxStockDTO } from "./InventoryBoxStockDTO";

export interface InventoryBoxDTO {
  id: string;
  code: string;
  createdAt: Date;
  updatedAt: Date;
}
export interface InventoryBoxWithExtendsDTO extends InventoryBoxDTO {
  stocks: InventoryBoxStockDTO;
}
