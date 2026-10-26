import { fromCents, toCents } from "@shared/domain/money";
import { todayInBusinessTz } from "@shared/domain/businessDate";
import { toDateOnly } from "@finance/domain/services/receivableStatus";
import {
  DocumentSummaryRow,
  FinancialDocumentReadMapper,
} from "@finance/application/mappers/FinancialDocumentReadMapper";
import { PurchaseDTO, PurchaseListItemDTO } from "../dto/PurchaseDTO";

/** Valor monetário vindo da persistência (Decimal do Prisma, string ou number). */
type Money = number | string | { toString(): string };

const money = (value: Money) => fromCents(toCents(Number(value)));

interface PurchaseBaseRow {
  id: string;
  code: string;
  status: string;
  purchaseDate: Date;
  totalAmount: Money;
  createdAt: Date;
  supplier: { id: string; name: string };
}

export interface PurchaseListRow extends PurchaseBaseRow {
  items: { quantity: number; receivedQuantity: number }[];
}

export interface PurchaseDetailRow extends PurchaseBaseRow {
  extraCosts: Money;
  notes: string | null;
  items: {
    id: string;
    quantity: number;
    receivedQuantity: number;
    unitPrice: Money;
    discount: Money;
    freight: Money;
    tax: Money;
    total: Money;
    unitCost: Money;
    productVariant: { id: string; name: string; code: string; barcode: string | null };
  }[];
}

/** floor(Σ recebido / Σ quantidade × 100), em inteiros. */
export function receivedPercent(items: { quantity: number; receivedQuantity: number }[]): number {
  const quantity = items.reduce((s, i) => s + i.quantity, 0);
  if (quantity === 0) return 0;
  const received = items.reduce((s, i) => s + i.receivedQuantity, 0);
  return Math.floor((received * 100) / quantity);
}

export class PurchaseReadMapper {
  static toListItemDTO(row: PurchaseListRow): PurchaseListItemDTO {
    return {
      id: row.id,
      code: row.code,
      status: row.status,
      supplier: { id: row.supplier.id, name: row.supplier.name },
      purchaseDate: toDateOnly(row.purchaseDate),
      totalAmount: money(row.totalAmount),
      itemsCount: row.items.length,
      receivedPercent: receivedPercent(row.items),
      createdAt: row.createdAt,
    };
  }

  static toDetailDTO(
    row: PurchaseDetailRow,
    payable: DocumentSummaryRow | null,
    now: Date = new Date(),
  ): PurchaseDTO {
    return {
      id: row.id,
      code: row.code,
      status: row.status,
      supplier: { id: row.supplier.id, name: row.supplier.name },
      purchaseDate: toDateOnly(row.purchaseDate),
      notes: row.notes,
      totalAmount: money(row.totalAmount),
      extraCosts: money(row.extraCosts),
      createdAt: row.createdAt,
      items: row.items.map((item) => ({
        id: item.id,
        productVariant: {
          id: item.productVariant.id,
          name: item.productVariant.name,
          code: item.productVariant.code,
          barcode: item.productVariant.barcode,
        },
        quantity: item.quantity,
        receivedQuantity: item.receivedQuantity,
        remainingQuantity: item.quantity - item.receivedQuantity,
        unitPrice: money(item.unitPrice),
        discount: money(item.discount),
        freight: money(item.freight),
        tax: money(item.tax),
        total: money(item.total),
        unitCost: money(item.unitCost),
      })),
      payable: payable ? FinancialDocumentReadMapper.toSummaryDTO(payable, todayInBusinessTz(now)) : null,
    };
  }
}
