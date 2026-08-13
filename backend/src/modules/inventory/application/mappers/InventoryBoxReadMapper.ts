import {
  InventoryBoxDTO,
  InventoryBoxWithExtendsDTO,
} from "../dto/InventoryBoxDTO";

export class InventoryBoxReadMapper {
  static toDTO(data: any): InventoryBoxDTO {
    return {
      id: data.id,
      code: data.code,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  }
  static toDTOWithExtends(data: any): InventoryBoxWithExtendsDTO {
    return {
      id: data.id,
      code: data.code,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      stocks: data.stocks.map((s) => ({
        inventoryLotId: s.inventoryLotId,
        boxId: s.boxId,
        quantity: s.quantity,
      })),
    };
  }
}
