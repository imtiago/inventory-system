import type { ProductVariant } from "@prisma/client";
import { ProductVariantDTO } from "../dto/ProductVariantDTO";

export class ProductVariantReadMapper {
  static toDTO(data: ProductVariant): ProductVariantDTO {
    return {
      id: data.id,
      barcode: data.barcode,
      code: data.code,
      name: data.name,
      productId: data.productId,
      salePrice: Number(data.salePrice),
      createdAt: data.createdAt,
    };
  }
}
