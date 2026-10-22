import {
  InventoryBoxDTO,
  InventoryBoxWithExtendsDTO,
} from "../dto/InventoryBoxDTO";
import { InventoryBoxStockReadMapper } from "./InventoryBoxStockReadMapper";
import { InventoryReadMapper } from "./InventoryReadMapper";

export class InventoryBoxReadMapper {
  static toDTO(data: any): InventoryBoxDTO {
    return {
      id: data.id,
      code: data.code,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  }

  /** `stocks[].inventoryLot` deve vir com `productVariant` e `boxStocks`. */
  static toDTOWithExtends(data: any): InventoryBoxWithExtendsDTO {
    const stocks = data.stocks.map((stock: any) => {
      const { boxId, inventoryLot } =
        InventoryBoxStockReadMapper.toDTOWithExtends(stock);
      return {
        boxId,
        inventoryLot,
        productVariant: InventoryReadMapper.toProductVariantSummary(
          stock.inventoryLot.productVariant,
        ),
      };
    });
    return {
      ...this.toDTO(data),
      stocks,
    };
  }
}
