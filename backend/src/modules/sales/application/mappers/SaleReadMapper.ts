import { fromCents, toCents } from "@shared/domain/money";
import { todayInBusinessTz } from "@shared/domain/businessDate";
import { parcelStatus, remainingCents, toDateOnly } from "@finance/domain/services/receivableStatus";
import { SaleCancelRequestDTO } from "../dto/SaleCancelRequestDTO";
import { SaleDetailDTO, SaleFinancingDTO, SaleListItemDTO, SaleReceivableDTO } from "../dto/SaleDTO";

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
  paymentCondition: string;
  cardInstallments: number | null;
  cardFeePassedOn: boolean;
  surchargeAmount: Money;
  downPayment: Money;
  financing?: SaleFinancingRow | null;
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

export interface SaleFinancingRow {
  cashPrice: Money;
  downPayment: Money;
  downPaymentMethod: string | null;
  financedAmount: Money;
  installments: number;
  monthlyRateBps: number;
  surchargeAmount: Money;
  totalAmount: Money;
  dueDay: number | null;
  firstDueDate: Date;
  overrideReason: string | null;
  overrideKinds: string[];
  overrideBy: PersonRow | null;
}

export interface SaleReceivableRow {
  id: string;
  status: string;
  parcels: {
    id: string;
    amount: Money;
    dueDate: Date;
    payments: { amount: Money; reversedAt: Date | null }[];
  }[];
}

export interface SaleListRow extends SaleBaseRow {
  _count: { items: number };
}

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
    pendingCancelRequest: SaleCancelRequestDTO | null = null,
    latestDecidedCancelRequest: SaleCancelRequestDTO | null = null,
  ): SaleDetailDTO {
    return {
      id: row.id,
      status: row.status,
      totalAmount: fromCents(cents(row.totalAmount)),
      paymentCondition: row.paymentCondition,
      cardInstallments: row.cardInstallments,
      cardFeePassedOn: row.cardFeePassedOn,
      surchargeAmount: fromCents(cents(row.surchargeAmount)),
      downPayment: fromCents(cents(row.downPayment)),
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
      financing: row.financing ? SaleReadMapper.toFinancingDTO(row.financing) : null,
      pendingCancelRequest,
      latestDecidedCancelRequest,
    };
  }

  private static toFinancingDTO(f: SaleFinancingRow): SaleFinancingDTO {
    return {
      cashPrice: fromCents(cents(f.cashPrice)),
      downPayment: fromCents(cents(f.downPayment)),
      downPaymentMethod: f.downPaymentMethod,
      financedAmount: fromCents(cents(f.financedAmount)),
      installments: f.installments,
      monthlyRatePercent: f.monthlyRateBps / 100,
      surchargeAmount: fromCents(cents(f.surchargeAmount)),
      totalAmount: fromCents(cents(f.totalAmount)),
      dueDay: f.dueDay,
      firstDueDate: toDateOnly(f.firstDueDate),
      override:
        f.overrideReason !== null
          ? {
              approver: f.overrideBy ? { id: f.overrideBy.id, name: f.overrideBy.name } : null,
              reason: f.overrideReason,
              kinds: f.overrideKinds,
            }
          : null,
    };
  }

  /** Mesma regra de status de parcela de contas a receber (data de negócio; estornos não contam). */
  private static toReceivableDTO(doc: SaleReceivableRow, now: Date): SaleReceivableDTO {
    const today = todayInBusinessTz(now);
    return {
      id: doc.id,
      status: doc.status,
      parcels: doc.parcels.map((parcel) => {
        const amounts = {
          amountCents: cents(parcel.amount),
          paidCents: parcel.payments.reduce((sum, p) => (p.reversedAt ? sum : sum + cents(p.amount)), 0),
          dueDate: toDateOnly(parcel.dueDate),
        };

        return {
          id: parcel.id,
          amount: fromCents(amounts.amountCents),
          dueDate: amounts.dueDate,
          paidAmount: fromCents(amounts.paidCents),
          remainingAmount: fromCents(remainingCents(amounts)),
          status: parcelStatus({ ...amounts, documentStatus: doc.status }, today),
        };
      }),
    };
  }
}
