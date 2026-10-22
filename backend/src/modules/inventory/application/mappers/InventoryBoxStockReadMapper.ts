import {
  InventoryBoxStockDTO,
  InventoryBoxStockWithExtendsDTO,
} from "../dto/InventoryBoxStockDTO";
import { InventoryLotReadMapper } from "./InventoryLotReadMapper";

export class InventoryBoxStockReadMapper {
  static toDTO(data: any): InventoryBoxStockDTO {
    return {
      boxId: data.boxId,
      inventoryLotId: data.inventoryLotId,
      quantity: data.quantity,
      updatedAt: data.updatedAt,
      createdAt: data.createdAt,
      id: data.id,
    };
  }
  static toDTOWithExtends(data: any): InventoryBoxStockWithExtendsDTO {
    return {
      ...this.toDTO(data),
      inventoryLot: InventoryLotReadMapper.toDTO(data.inventoryLot),
    };
  }
}
