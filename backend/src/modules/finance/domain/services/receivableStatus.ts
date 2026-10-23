// Regras puras de status de contas a receber, compartilhadas por entidades e
// mappers de leitura (finance e detalhe da venda). Datas "YYYY-MM-DD"; "hoje" é
// a data de negócio (todayInBusinessTz) — comparação lexicográfica de datas.

import { FinancialStatus } from "../enums/FinancialStatus";
import { ParcelStatus } from "../enums/ParcelStatus";

export interface ParcelAmounts {
  amountCents: number;
  /** Soma dos pagamentos não estornados. */
  paidCents: number;
  dueDate: string;
}

export interface ParcelStatusInput extends ParcelAmounts {
  documentStatus: FinancialStatus | string;
}

/** Restante a receber da parcela (nunca negativo). */
export function remainingCents(parcel: Pick<ParcelAmounts, "amountCents" | "paidCents">): number {
  return Math.max(parcel.amountCents - parcel.paidCents, 0);
}

/**
 * Parcela com saldo e vencimento anterior a hoje. Inclui parcela parcialmente
 * paga já vencida (o saldo dela está vencido), embora o status dela seja PARTIALLY_PAID.
 */
export function hasOverdueBalance(parcel: ParcelAmounts, today: string): boolean {
  return remainingCents(parcel) > 0 && parcel.dueDate < today;
}

/**
 * Documento CANCELED → CANCELED; pago ≥ valor → PAID; pago > 0 → PARTIALLY_PAID;
 * vencimento < hoje → OVERDUE; senão OPEN (vence hoje = OPEN).
 */
export function parcelStatus(parcel: ParcelStatusInput, today: string): ParcelStatus {
  if (parcel.documentStatus === FinancialStatus.CANCELED) return ParcelStatus.CANCELED;
  if (parcel.paidCents >= parcel.amountCents) return ParcelStatus.PAID;
  if (parcel.paidCents > 0) return ParcelStatus.PARTIALLY_PAID;
  if (parcel.dueDate < today) return ParcelStatus.OVERDUE;
  return ParcelStatus.OPEN;
}

/**
 * Status persistido do documento a partir das parcelas: CANCELED mantém; todas
 * pagas → PAID; algum pagamento ativo → PARTIALLY_PAID; senão OPEN.
 */
export function documentStatusFor(
  current: FinancialStatus,
  parcels: Pick<ParcelAmounts, "amountCents" | "paidCents">[],
): FinancialStatus {
  if (current === FinancialStatus.CANCELED) return FinancialStatus.CANCELED;
  if (parcels.length > 0 && parcels.every((p) => p.paidCents >= p.amountCents)) {
    return FinancialStatus.PAID;
  }
  if (parcels.some((p) => p.paidCents > 0)) return FinancialStatus.PARTIALLY_PAID;
  return FinancialStatus.OPEN;
}

export type DisplayStatus = FinancialStatus | "OVERDUE";

/** Status de exibição: o do documento, exceto OVERDUE se aberto/parcial com saldo vencido. */
export function documentDisplayStatus(
  documentStatus: FinancialStatus | string,
  parcels: ParcelAmounts[],
  today: string,
): DisplayStatus {
  const status = documentStatus as FinancialStatus;
  if (status === FinancialStatus.CANCELED || status === FinancialStatus.PAID) return status;
  return parcels.some((p) => hasOverdueBalance(p, today)) ? "OVERDUE" : status;
}

/** Data "YYYY-MM-DD" de um vencimento/pagamento persistido à meia-noite UTC. */
export function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** "YYYY-MM-DD" → Date à meia-noite UTC (convenção de persistência de datas sem hora). */
export function fromDateOnly(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}
