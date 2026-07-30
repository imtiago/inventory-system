// application/mappers/StockMovementReadMapper.ts

import { StockMovementWithExtendsDTO } from "../dto/StockMovementDTO";

export class StockMovementReadMapper {
  static toDTO(data: any): StockMovementWithExtendsDTO {
    return {
      id: data.id,
      inventoryId: data.inventoryId,
      productVariantId: data.productVariantId,
      quantity: data.quantity,
      type: data.type,
      origin: data.origin,
      originId: data.originId,
      userId: data.userId,
      notes: data.notes,
      createdAt: data.createdAt,
      inventory: {
        id: data.inventory.id,
        availableQuantity: data.inventory.availableQuantity,
        createdAt: data.inventory.createdAt,
        minimumStock: data.inventory.minimumStock,
        productVariantId: data.inventory.productVariantId,
        quantity: data.inventory.quantity,
        reservedQuantity: data.inventory.reservedQuantity,
      },
      user: {
        id: data.user.id,
        name: data.user.name,
      },
      productVariant: {
        id: data.inventory.id,
        barcode: data.productVariant.barcode,
        code: data.productVariant.code,
        name: data.productVariant.name,
        productId: data.productVariant.productId,
        createdAt: data.productVariant.createdAt,
        salePrice: data.productVariant.salePrice,
      },
    };
  }
}
