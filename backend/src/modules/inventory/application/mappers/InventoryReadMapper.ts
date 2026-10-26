import { ProductVariantSummaryDTO } from "../dto/CommonDTO";
import type { InventoryRow, ProductVariantSummaryRow } from "./readRows";
import { InventoryDTO, InventoryWithExtendsDTO } from "../dto/InventoryDTO";

export class InventoryReadMapper {
  static toBaseDTO(data: InventoryRow, expired = 0): InventoryDTO {
    return {
      id: data.id,
      productVariantId: data.productVariantId,
      quantity: data.quantity,
      reservedQuantity: data.reservedQuantity,
      availableQuantity: data.quantity - data.reservedQuantity,
      minimumStock: data.minimumStock,
      averageCost: Number(data.averageCost),
      expired,
      createdAt: data.createdAt,
    };
  }

  static toProductVariantSummary(data: ProductVariantSummaryRow): ProductVariantSummaryDTO {
    return {
      id: data.id,
      code: data.code,
      name: data.name,
      barcode: data.barcode ?? null,
      productId: data.productId,
    };
  }

  static toDTO(data: InventoryRow & { productVariant: ProductVariantSummaryRow }, expired = 0): InventoryWithExtendsDTO {
    return {
      ...this.toBaseDTO(data, expired),
      productVariant: this.toProductVariantSummary(data.productVariant),
    };
  }
}
