import { SaleItem as PrismaSaleItem, Prisma } from "@prisma/client";
import { SaleItem } from "@sales/domain/entities/SaleItem";
import { toCost4 } from "@shared/domain/cost4";
import { fromCents, toCents } from "@shared/domain/money";

export class SaleItemMapper {
  // Banco -> Domínio
  static toDomain(prisma: PrismaSaleItem): SaleItem {
    return new SaleItem({
      id: prisma.id,
      variantId: prisma.productVariantId,
      variantName: prisma.productName,
      variantCode: prisma.sku ?? "",
      barcode: prisma.barcode,
      quantity: prisma.quantity,
      unitPriceCents: toCents(Number(prisma.unitPrice)),
      unitCost4: prisma.unitCost === null ? null : toCost4(Number(prisma.unitCost)),
    });
  }

  // Domínio -> Banco (Create). `sku` guarda o snapshot do código da variante.
  static toCreatePersistence(
    item: SaleItem,
  ): Prisma.SaleItemUncheckedCreateWithoutSaleInput {
    return {
      id: item.id,
      productVariantId: item.variantId,
      productName: item.variantName,
      sku: item.variantCode,
      barcode: item.barcode,
      quantity: item.quantity,
      unitPrice: fromCents(item.unitPriceCents),
      unitCost: item.unitCost4 === null ? null : item.unitCost4 / 10_000,
    };
  }
}
