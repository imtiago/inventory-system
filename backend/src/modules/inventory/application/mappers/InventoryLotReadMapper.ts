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
      batchNumber: data.batchNumber,
      createdAt: data.createdAt,
      expirationDate: data.expirationDate,
    };
  }
  static toDTOWithExtends(data: any): InventoryLotWithExtendsDTO {
    const inventoryLot = this.toDTO(data);

    const productVariant = {
      id: data.productVariant.id,
      name: data.productVariant.name,
      code: data.productVariant.code,
      barcode: data.productVariant.barcode,
      createdAt: data.productVariant.createdAt,
      productId: data.productVariant.productId,
    };

    return {
      ...inventoryLot,
      productVariant,
    };
  }
}
