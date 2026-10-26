import {
  InventoryBoxStockDTO,
  InventoryBoxStockWithExtendsDTO,
} from "../dto/InventoryBoxStockDTO";
import { InventoryLotReadMapper } from "./InventoryLotReadMapper";
import type { InventoryBoxStockRow, InventoryBoxStockWithLotRow } from "./readRows";

export class InventoryBoxStockReadMapper {
  static toDTO(data: InventoryBoxStockRow): InventoryBoxStockDTO {
    return {
      boxId: data.boxId,
      inventoryLotId: data.inventoryLotId,
      quantity: data.quantity,
      updatedAt: data.updatedAt,
      createdAt: data.createdAt,
      id: data.id,
    };
  }
  static toDTOWithExtends(data: InventoryBoxStockWithLotRow): InventoryBoxStockWithExtendsDTO {
    return {
      ...this.toDTO(data),
      inventoryLot: InventoryLotReadMapper.toDTO(data.inventoryLot),
    };
  }
}
