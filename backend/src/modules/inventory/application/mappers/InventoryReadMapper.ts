import { InventoryWithExtendsDTO } from "../dto/InventoryDTO";

export class InventoryReadMapper {
  static toDTO(data: any): InventoryWithExtendsDTO {
    return {
      id: data.id,
      availableQuantity: data.quantity - data.reservedQuantity,
      createdAt: data.createdAt,
      minimumStock: data.minimumStock,
      productVariantId: data.productVariantId,
      productVariant: {
        id: data.productVariant.id,
        name: data.productVariant.name,
        barcode: data.productVariant.barcode,
        code: data.productVariant.code,
        productId: data.productVariant.productId,
        salePrice: data.productVariant.salePrice,
        createdAt: data.productVariant.createdAt,
      },
      quantity: data.quantity,
      reservedQuantity: data.reservedQuantity,
    };
  }
}
