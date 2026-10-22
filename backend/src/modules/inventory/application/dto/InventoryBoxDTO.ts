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

export interface ICreateInventoryBoxInput {}
export interface IGenerateInventoryBoxLabelInput {
  code: string;
}

export interface IGenerateInventoryProductLabelsInput {
  boxCode: string;
  productCode: string;
  quantity: number;
}
export interface IInventoryBoxOutput {
  id: string;
  code: string;
}
