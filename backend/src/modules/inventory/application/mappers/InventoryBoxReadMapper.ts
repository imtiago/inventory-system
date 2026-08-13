import {
  InventoryBoxDTO,
  InventoryBoxWithExtendsDTO,
} from "../dto/InventoryBoxDTO";
import { InventoryBoxStockReadMapper } from "./InventoryBoxStockReadMapper";

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
    const inventoryBox = this.toDTO(data);
    const stocks = data.stocks.map((stock) => {
      const {
        inventoryLot: { productVariant, ...restLot },
        boxId,
      } = InventoryBoxStockReadMapper.toDTOWithExtends(stock);
      return {
        boxId,
        inventoryLot: restLot,
        productVariant,
      };
    });
    return {
      ...inventoryBox,
      stocks,
    };
  }
}
