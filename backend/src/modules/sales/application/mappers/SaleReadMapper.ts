import { fromCents, toCents } from "@shared/domain/money";
import { SaleDetailDTO, SaleListItemDTO, SaleReceivableDTO } from "../dto/SaleDTO";

/** Valor monetário vindo da persistência (Decimal do Prisma, string ou number). */
type Money = number | string | { toString(): string };

const cents = (value: Money) => toCents(Number(value));

interface PersonRow {
  id: string;
  name: string;
}

interface SaleBaseRow {
  id: string;
  status: string;
  totalAmount: Money;
  createdAt: Date;
  customer: PersonRow;
}

export interface SaleDetailRow extends SaleBaseRow {
  seller: PersonRow | null;
  items: {
    id: string;
    productVariantId: string;
    productName: string;
    sku: string | null;
    barcode: string | null;
    quantity: number;
    unitPrice: Money;
    productVariant: { code: string };
  }[];
}

export interface SaleReceivableRow {
  id: string;
  status: string;
  parcels: {
    id: string;
    amount: Money;
    dueDate: Date;
    payments: { amount: Money }[];
  }[];
}

export interface SaleListRow extends SaleBaseRow {
  _count: { items: number };
}

const startOfTodayUtc = (now: Date) =>
  new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

export class SaleReadMapper {
  static toListItemDTO(row: SaleListRow): SaleListItemDTO {
    return {
      id: row.id,
      status: row.status,
      totalAmount: fromCents(cents(row.totalAmount)),
      createdAt: row.createdAt,
      customer: { id: row.customer.id, name: row.customer.name },
      itemsCount: row._count.items,
    };
  }

  static toDetailDTO(
    row: SaleDetailRow,
    receivable: SaleReceivableRow | null,
    now: Date = new Date(),
  ): SaleDetailDTO {
    return {
      id: row.id,
      status: row.status,
      totalAmount: fromCents(cents(row.totalAmount)),
      createdAt: row.createdAt,
      customer: { id: row.customer.id, name: row.customer.name },
      seller: row.seller ? { id: row.seller.id, name: row.seller.name } : null,
      items: row.items.map((item) => {
        const unitPriceCents = cents(item.unitPrice);
        return {
          id: item.id,
          // Snapshot gravado na venda (nome, código, código de barras).
          productVariant: {
            id: item.productVariantId,
            name: item.productName,
            code: item.sku ?? item.productVariant.code,
            barcode: item.barcode,
          },
          quantity: item.quantity,
          unitPrice: fromCents(unitPriceCents),
          totalPrice: fromCents(unitPriceCents * item.quantity),
        };
      }),
      receivable: receivable ? SaleReadMapper.toReceivableDTO(receivable, now) : null,
    };
  }

  private static toReceivableDTO(doc: SaleReceivableRow, now: Date): SaleReceivableDTO {
    const today = startOfTodayUtc(now);
    return {
      id: doc.id,
      status: doc.status,
      parcels: doc.parcels.map((parcel) => {
        const amountCents = cents(parcel.amount);
        const paidCents = parcel.payments.reduce((sum, p) => sum + cents(p.amount), 0);

        let status: string;
        if (doc.status === "CANCELED") status = "CANCELED";
        else if (paidCents >= amountCents) status = "PAID";
        else if (paidCents > 0) status = "PARTIALLY_PAID";
        else if (parcel.dueDate < today) status = "OVERDUE";
        else status = "OPEN";

        return {
          id: parcel.id,
          amount: fromCents(amountCents),
          dueDate: parcel.dueDate.toISOString().slice(0, 10),
          paidAmount: fromCents(paidCents),
          remainingAmount: fromCents(Math.max(amountCents - paidCents, 0)),
          status,
        };
      }),
    };
  }
}
