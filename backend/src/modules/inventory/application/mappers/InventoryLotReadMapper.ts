import {
  InventoryLotDTO,
  InventoryLotWithExtendsDTO,
} from "../dto/InventoryLotDTO";

export class InventoryLotReadMapper {
  static toDTO(data: any): InventoryLotDTO {
    return {
      id: data.id,
      productVariantId: data.productVariantId,
      quantity: data.quantity,
      reservedQuantity: data.reservedQuantity,
      availableQuantity: data.availableQuantity,
      minimumStock: data.minimumStock,
      createdAt: data.createdAt,
    };
  }
  static toDTOWithExtends(data: any): InventoryLotWithExtendsDTO {
    const inventoryLot = this.toDTO(data);

    return {
      ...inventoryLot,
      stocks: data.stocks.map((s) => ({
        inventoryLotId: s.inventoryLotId,
        boxId: s.boxId,
        quantity: s.quantity,
      })),
    };
  }
}
