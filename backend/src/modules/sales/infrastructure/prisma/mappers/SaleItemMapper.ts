// src/modules/sales/infrastructure/mappers/SaleItemMapper.ts

import { SaleItem as PrismaSaleItem, Prisma } from "@prisma/client";
import { SaleItem } from "@sales/domain/entities/SaleItem";

export class SaleItemMapper {
  // Banco -> Domínio
  static toDomain(prisma: PrismaSaleItem): SaleItem {
    return new SaleItem({
      id: prisma.id,

      productVariantId: prisma.productVariantId,

      quantity: prisma.quantity,

      price: prisma.price,
    });
  }

  // Domínio -> Banco (Create)
  static toCreatePersistence(
    item: SaleItem,
  ): Prisma.SaleItemCreateWithoutSaleInput {
    return {
      id: item.id,

      productVariantId: item.productVariantId,

      quantity: item.quantity,

      price: item.price,
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
