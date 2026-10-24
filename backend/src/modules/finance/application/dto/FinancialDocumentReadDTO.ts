// Contrato de leitura de contas a receber (spec 3B §4) e a pagar (spec 6A).
// Mesma forma para os dois tipos; muda a contraparte (cliente × fornecedor),
// o código do pedido (só a pagar) e o nome do total pago no resumo.
// Valores monetários com 2 casas (calculados em centavos); datas "YYYY-MM-DD".

import { FinancialType } from "@finance/domain/enums/FinancialType";

export type FinancialStatusFilter = "OPEN" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" | "CANCELED";

export interface PersonRefDTO {
  id: string;
  name: string;
}

/** Campos comuns do item de lista (sem a contraparte). */
export interface FinancialListItemBaseDTO {
  id: string;
  status: string;
  displayStatus: string;
  originType: string;
  originId: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  nextDueDate: string | null;
  parcelsCount: number;
  createdAt: Date;
}

export interface FinancialPaymentDTO {
  id: string;
  amount: number;
  method: string;
  paymentDate: string;
  reference: string | null;
  createdAt: Date;
  createdBy: PersonRefDTO | null;
  reversedAt: Date | null;
  reversedBy: PersonRefDTO | null;
  reversalReason: string | null;
}

export interface FinancialParcelDTO {
  id: string;
  number: number;
  amount: number;
  dueDate: string;
  paidAmount: number;
  remainingAmount: number;
  status: string;
  payments: FinancialPaymentDTO[];
}

/** Campos comuns do detalhe (sem a contraparte). */
export interface FinancialDetailBaseDTO {
  id: string;
  status: string;
  displayStatus: string;
  originType: string;
  originId: string;
  createdAt: Date;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  parcels: FinancialParcelDTO[];
}

/** Contraparte de cada tipo, embutida no item de lista e no detalhe. */
export interface ReceivableParty {
  customer: PersonRefDTO;
}
export interface PayableParty {
  supplier: PersonRefDTO;
  purchaseCode: string;
}

export type ReceivableListItemDTO = FinancialListItemBaseDTO & ReceivableParty;
export type PayableListItemDTO = FinancialListItemBaseDTO & PayableParty;
export type ReceivableDetailDTO = FinancialDetailBaseDTO & ReceivableParty;
export type PayableDetailDTO = FinancialDetailBaseDTO & PayableParty;

export interface ReceivableSummaryDTO {
  /** Saldo a vencer (vencimento ≥ hoje) de documentos não cancelados. */
  openAmount: number;
  /** Saldo vencido (vencimento < hoje) de documentos não cancelados. */
  overdueAmount: number;
  /** Soma dos pagamentos ativos (não estornados). */
  receivedAmount: number;
}

export interface PayableSummaryDTO {
  openAmount: number;
  overdueAmount: number;
  /** Soma dos pagamentos ativos (não estornados). */
  paidAmount: number;
}

/** DTOs de leitura por tipo de documento. */
export interface FinancialReadDTOs {
  [FinancialType.RECEIVABLE]: {
    listItem: ReceivableListItemDTO;
    detail: ReceivableDetailDTO;
    summary: ReceivableSummaryDTO;
  };
  [FinancialType.PAYABLE]: {
    listItem: PayableListItemDTO;
    detail: PayableDetailDTO;
    summary: PayableSummaryDTO;
  };
}

export type FinancialDocumentDetailDTO<T extends FinancialType = FinancialType> = FinancialReadDTOs[T]["detail"];

export interface FinancialListFilters {
  status?: FinancialStatusFilter;
  /** Cliente (a receber) ou fornecedor (a pagar). */
  partyId?: string;
  dueFrom?: string;
  dueTo?: string;
  /** Só documentos não cancelados com saldo (e, com intervalo, parcela com saldo nele). */
  openOnly?: boolean;
}

export interface FinancialListResult<T extends FinancialType = FinancialType> {
  data: FinancialReadDTOs[T]["listItem"][];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  summary: FinancialReadDTOs[T]["summary"];
}

export type ReceivableListResult = FinancialListResult<FinancialType.RECEIVABLE>;
export type PayableListResult = FinancialListResult<FinancialType.PAYABLE>;
