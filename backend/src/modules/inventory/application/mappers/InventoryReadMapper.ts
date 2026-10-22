import { ProductVariantSummaryDTO } from "../dto/CommonDTO";
import { InventoryDTO, InventoryWithExtendsDTO } from "../dto/InventoryDTO";

export class InventoryReadMapper {
  static toBaseDTO(data: any): InventoryDTO {
    return {
      id: data.id,
      productVariantId: data.productVariantId,
      quantity: data.quantity,
      reservedQuantity: data.reservedQuantity,
      availableQuantity: data.quantity - data.reservedQuantity,
      minimumStock: data.minimumStock,
      averageCost: Number(data.averageCost),
      createdAt: data.createdAt,
    };
  }

  static toProductVariantSummary(data: any): ProductVariantSummaryDTO {
    return {
      id: data.id,
      code: data.code,
      name: data.name,
      barcode: data.barcode ?? null,
      productId: data.productId,
    };
  }

  static toDTO(data: any): InventoryWithExtendsDTO {
    return {
      ...this.toBaseDTO(data),
      productVariant: this.toProductVariantSummary(data.productVariant),
    };
  }
}
