import {
  InventoryBoxDTO,
  InventoryBoxWithExtendsDTO,
} from "../dto/InventoryBoxDTO";
import { InventoryBoxStockReadMapper } from "./InventoryBoxStockReadMapper";
import { InventoryReadMapper } from "./InventoryReadMapper";
import type { InventoryBoxRow, InventoryBoxWithStocksRow } from "./readRows";

export class InventoryBoxReadMapper {
  static toDTO(data: InventoryBoxRow): InventoryBoxDTO {
    return {
      id: data.id,
      code: data.code,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  }

  /** `stocks[].inventoryLot` deve vir com `productVariant` e `boxStocks`. */
  static toDTOWithExtends(data: InventoryBoxWithStocksRow): InventoryBoxWithExtendsDTO {
    const stocks = data.stocks.map((stock) => {
      const { id, boxId, quantity, inventoryLot } =
        InventoryBoxStockReadMapper.toDTOWithExtends(stock);
      return {
        id,
        boxId,
        quantity,
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
