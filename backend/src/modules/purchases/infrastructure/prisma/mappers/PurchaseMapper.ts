import { Prisma, Purchase as PrismaPurchase, PurchaseItem as PrismaPurchaseItem } from "@prisma/client";
import { fromCents, toCents } from "@shared/domain/money";
import { fromDateOnly, toDateOnly } from "@finance/domain/services/receivableStatus";
import { Purchase } from "@purchases/domain/entities/Purchase";
import { PurchaseItem } from "@purchases/domain/entities/PurchaseItem";
import { PurchaseOrigin } from "@purchases/domain/enums/PurchaseOrigin";
import { PurchaseStatus } from "@purchases/domain/enums/PurchaseStatus";

const cents = (value: Prisma.Decimal) => toCents(value.toNumber());

export class PurchaseMapper {
  static toDomain(row: PrismaPurchase & { items: PrismaPurchaseItem[] }): Purchase {
    return new Purchase({
      id: row.id,
      code: row.code,
      supplierId: row.supplierId,
      status: row.status as PurchaseStatus,
      origin: row.origin as PurchaseOrigin,
      purchaseDate: toDateOnly(row.purchaseDate),
      notes: row.notes,
      cancelReason: row.cancelReason,
      canceledAt: row.canceledAt,
      canceledById: row.canceledById,
      createdAt: row.createdAt,
      // Ordem do pedido (position); id desempata.
      items: [...row.items]
        .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))
        .map(
          (item) =>
            new PurchaseItem({
              id: item.id,
              productVariantId: item.productVariantId,
              quantity: item.quantity,
              receivedQuantity: item.receivedQuantity,
              unitPriceCents: cents(item.unitPrice),
              discountCents: cents(item.discount),
              freightCents: cents(item.freight),
              taxCents: cents(item.tax),
            }),
        ),
    });
  }

  static toCreatePersistence(purchase: Purchase): Prisma.PurchaseUncheckedCreateInput {
    return {
      id: purchase.id,
      code: purchase.code,
      supplierId: purchase.supplierId,
      status: purchase.status,
      origin: purchase.origin,
      purchaseDate: fromDateOnly(purchase.purchaseDate),
      totalAmount: fromCents(purchase.totalAmountCents),
      notes: purchase.notes,
      createdAt: purchase.createdAt,
      items: {
        create: purchase.items.map((item, position) => ({
          id: item.id,
          position,
          productVariantId: item.productVariantId,
          quantity: item.quantity,
          receivedQuantity: item.receivedQuantity,
          unitPrice: fromCents(item.unitPriceCents),
          discount: fromCents(item.discountCents),
          freight: fromCents(item.freightCents),
          tax: fromCents(item.taxCents),
          total: fromCents(item.totalCents),
          unitCost: item.unitCost,
        })),
      },
    };
  }

  static toUpdatePersistence(purchase: Purchase): Prisma.PurchaseUncheckedUpdateInput {
    return {
      status: purchase.status,
      cancelReason: purchase.cancelReason,
      canceledAt: purchase.canceledAt,
      canceledById: purchase.canceledById,
      // Recebimentos: grava o acumulado de cada item.
      items: {
        update: purchase.items.map((item) => ({
          where: { id: item.id },
          data: { receivedQuantity: item.receivedQuantity },
        })),
      },
    };
  }
}
