import { ProductVariantDTO } from "../dto/ProductVariantDTO";

export class ProductVariantReadMapper {
  static toDTO(data: any): ProductVariantDTO {
    return {
      id: data.id,
      barcode: data.barcode,
      code: data.code,
      name: data.name,
      productId: data.product.id,
      salePrice: data.salePrice,
      createdAt: data.createdAt,
    };
  }
}
