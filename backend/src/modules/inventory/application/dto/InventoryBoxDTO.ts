import { ProductVariantSummaryDTO } from "./CommonDTO";
import { InventoryLotDTO } from "./InventoryLotDTO";

export interface InventoryBoxDTO {
  id: string;
  code: string;
  createdAt: Date;
  updatedAt: Date;
}
export interface InventoryBoxStockItemDTO {
  boxId: string;
  inventoryLot: InventoryLotDTO;
  productVariant: ProductVariantSummaryDTO;
}
export interface InventoryBoxWithExtendsDTO extends InventoryBoxDTO {
  stocks: InventoryBoxStockItemDTO[];
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
