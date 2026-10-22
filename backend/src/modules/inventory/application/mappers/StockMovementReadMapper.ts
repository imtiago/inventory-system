// application/mappers/StockMovementReadMapper.ts

import { StockMovementWithExtendsDTO } from "../dto/StockMovementDTO";
import { InventoryReadMapper } from "./InventoryReadMapper";

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
      inventory: InventoryReadMapper.toBaseDTO(data.inventory),
      user: data.user ? { id: data.user.id, name: data.user.name } : null,
      productVariant: {
        id: data.productVariant.id,
        barcode: data.productVariant.barcode,
        code: data.productVariant.code,
        name: data.productVariant.name,
        productId: data.productVariant.productId,
        createdAt: data.productVariant.createdAt,
      },
    };
  }
}
