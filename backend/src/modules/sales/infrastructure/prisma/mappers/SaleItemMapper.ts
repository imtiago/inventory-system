// src/modules/sales/infrastructure/mappers/SaleItemMapper.ts

import { SaleItem as PrismaSaleItem, Prisma } from "@prisma/client";
import { SaleItem } from "@sales/domain/entities/SaleItem";

export class SaleItemMapper {
  // Banco -> Domínio
  static toDomain(prisma: PrismaSaleItem): SaleItem {
    return new SaleItem({
      id: prisma.id,
      variantId: prisma.productVariantId,
      quantity: prisma.quantity,
      unitPrice: prisma.unitPrice,
      variantCode: "",
    });
  }

  // Domínio -> Banco (Create)
  static toCreatePersistence(
    item: SaleItem,
  ): Prisma.SaleItemUncheckedCreateWithoutSaleInput {
    return {
      id: item.id,
      productName: item.variantName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      productVariantId: item.variantId,
    };
  }

  // Domínio -> Banco (Update)
  static toUpdatePersistence(item: SaleItem): Prisma.SaleItemUpdateInput {
    return {
      quantity: item.quantity,

      price: item.price,
    };
  }
}
