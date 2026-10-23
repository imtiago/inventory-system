import { fromCents, toCents } from "@shared/domain/money";
import {
  DisplayStatus,
  documentDisplayStatus,
  hasOverdueBalance,
  parcelStatus,
  remainingCents,
  toDateOnly,
} from "@finance/domain/services/receivableStatus";
import { FinancialStatus } from "@finance/domain/enums/FinancialStatus";
import {
  FinancialDetailBaseDTO,
  FinancialListItemBaseDTO,
  FinancialPaymentDTO,
  PersonRefDTO,
} from "../dto/FinancialDocumentReadDTO";
import { FinancialDocumentSummaryDTO } from "../dto/FinancialDocumentSummaryDTO";

/** Valor monetário vindo da persistência (Decimal do Prisma, string ou number). */
type Money = number | string | { toString(): string };

const cents = (value: Money) => toCents(Number(value));

export interface PaymentAmountRow {
  amount: Money;
  reversedAt: Date | null;
}

export interface PaymentDetailRow extends PaymentAmountRow {
  id: string;
  method: string;
  paymentDate: Date;
  reference: string | null;
  createdAt: Date;
  reversalReason: string | null;
  createdBy: PersonRefDTO | null;
  reversedBy: PersonRefDTO | null;
}

export interface FinancialDocumentRow<P extends PaymentAmountRow = PaymentAmountRow> {
  id: string;
  status: string;
  originType: string;
  originId: string;
  partyId: string;
  createdAt: Date;
  parcels: { id: string; amount: Money; dueDate: Date; payments: P[] }[];
}

/** Valores derivados de um documento na data de negócio `today` (tudo em centavos). */
export interface FinancialFigures {
  displayStatus: DisplayStatus;
  totalCents: number;
  paidCents: number;
  remainingCents: number;
  /** Saldo com vencimento < hoje (0 se cancelado). */
  overdueCents: number;
  /** Saldo com vencimento ≥ hoje (0 se cancelado). */
  notDueCents: number;
  /** Menor vencimento entre parcelas com saldo; null se cancelado ou quitado. */
  nextDueDate: string | null;
}

const activePaidCents = (payments: PaymentAmountRow[]) =>
  payments.reduce((sum, p) => (p.reversedAt ? sum : sum + cents(p.amount)), 0);

/** Linha mínima de um documento para o resumo (qualquer tipo). */
export interface DocumentSummaryRow {
  id: string;
  status: string;
  parcels: FinancialDocumentRow["parcels"];
}

/** Parcelas ordenadas por vencimento (desempate por id), em centavos. */
function parcelAmounts<P extends PaymentAmountRow>(row: Pick<FinancialDocumentRow<P>, "parcels">) {
  return [...row.parcels]
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime() || a.id.localeCompare(b.id))
    .map((p) => ({
      row: p,
      amountCents: cents(p.amount),
      paidCents: activePaidCents(p.payments),
      dueDate: toDateOnly(p.dueDate),
    }));
}

export class FinancialDocumentReadMapper {
  static figures(row: FinancialDocumentRow, today: string): FinancialFigures {
    const parcels = parcelAmounts(row);
    const canceled = row.status === FinancialStatus.CANCELED;
    const withBalance = parcels.filter((p) => remainingCents(p) > 0);

    let overdueCents = 0;
    let notDueCents = 0;
    if (!canceled) {
      for (const p of withBalance) {
        if (hasOverdueBalance(p, today)) overdueCents += remainingCents(p);
        else notDueCents += remainingCents(p);
      }
    }

    return {
      displayStatus: documentDisplayStatus(row.status, parcels, today),
      totalCents: parcels.reduce((s, p) => s + p.amountCents, 0),
      paidCents: parcels.reduce((s, p) => s + p.paidCents, 0),
      remainingCents: parcels.reduce((s, p) => s + remainingCents(p), 0),
      overdueCents,
      notDueCents,
      nextDueDate: canceled || withBalance.length === 0 ? null : withBalance[0].dueDate,
    };
  }

  /** Item de lista sem a contraparte (o repositório junta cliente ou fornecedor). */
  static toListItemDTO(
    row: FinancialDocumentRow,
    today: string,
    figures: FinancialFigures = FinancialDocumentReadMapper.figures(row, today),
  ): FinancialListItemBaseDTO {
    return {
      id: row.id,
      status: row.status,
      displayStatus: figures.displayStatus,
      originType: row.originType,
      originId: row.originId,
      totalAmount: fromCents(figures.totalCents),
      paidAmount: fromCents(figures.paidCents),
      remainingAmount: fromCents(figures.remainingCents),
      nextDueDate: figures.nextDueDate,
      parcelsCount: row.parcels.length,
      createdAt: row.createdAt,
    };
  }

  /** Detalhe sem a contraparte (o repositório junta cliente ou fornecedor). */
  static toDetailDTO(row: FinancialDocumentRow<PaymentDetailRow>, today: string): FinancialDetailBaseDTO {
    const figures = FinancialDocumentReadMapper.figures(row, today);
    return {
      id: row.id,
      status: row.status,
      displayStatus: figures.displayStatus,
      originType: row.originType,
      originId: row.originId,
      createdAt: row.createdAt,
      totalAmount: fromCents(figures.totalCents),
      paidAmount: fromCents(figures.paidCents),
      remainingAmount: fromCents(figures.remainingCents),
      parcels: parcelAmounts(row).map((p, index) => ({
        id: p.row.id,
        number: index + 1,
        amount: fromCents(p.amountCents),
        dueDate: p.dueDate,
        paidAmount: fromCents(p.paidCents),
        remainingAmount: fromCents(remainingCents(p)),
        status: parcelStatus({ ...p, documentStatus: row.status }, today),
        payments: [...p.row.payments]
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id))
          .map(FinancialDocumentReadMapper.toPaymentDTO),
      })),
    };
  }

  /**
   * Resumo type-agnostic (a receber ou a pagar): status de exibição e parcelas
   * numeradas por vencimento, com as mesmas regras de status do detalhe.
   */
  static toSummaryDTO(row: DocumentSummaryRow, today: string): FinancialDocumentSummaryDTO {
    return {
      id: row.id,
      status: row.status,
      displayStatus: documentDisplayStatus(row.status, parcelAmounts(row), today),
      parcels: parcelAmounts(row).map((p, index) => ({
        id: p.row.id,
        number: index + 1,
        amount: fromCents(p.amountCents),
        dueDate: p.dueDate,
        paidAmount: fromCents(p.paidCents),
        remainingAmount: fromCents(remainingCents(p)),
        status: parcelStatus({ ...p, documentStatus: row.status }, today),
      })),
    };
  }

  /** Contraparte encontrada ou placeholder com o partyId (não há FK). */
  static party(partyId: string, found: PersonRefDTO | undefined, unknownName: string): PersonRefDTO {
    return found ? { id: found.id, name: found.name } : { id: partyId, name: unknownName };
  }

  private static toPaymentDTO(payment: PaymentDetailRow): FinancialPaymentDTO {
    return {
      id: payment.id,
      amount: fromCents(cents(payment.amount)),
      method: payment.method,
      paymentDate: toDateOnly(payment.paymentDate),
      reference: payment.reference,
      createdAt: payment.createdAt,
      createdBy: payment.createdBy ? { id: payment.createdBy.id, name: payment.createdBy.name } : null,
      reversedAt: payment.reversedAt,
      reversedBy: payment.reversedBy ? { id: payment.reversedBy.id, name: payment.reversedBy.name } : null,
      reversalReason: payment.reversalReason,
    };
  }
}
