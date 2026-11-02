/** Migração do caderninho: lotes de dívidas antigas (contrato de `/legacy-imports`). Valores em reais, datas `YYYY-MM-DD`. */

export type LegacyBatchStatus = 'DRAFT' | 'CONFIRMED' | 'REVERTED';
export type LegacyBatchSource = 'CSV' | 'MANUAL';
export type LegacyRowStatus = 'OK' | 'WARNING' | 'ERROR' | 'IGNORED';
export type LegacyLimitRule = 'MAX_OF_PROFILE_AND_BALANCE' | 'PROFILE_ONLY';
export type CreditProfileCode = 'NEW' | 'REGULAR' | 'GOOD' | 'EXCELLENT';

/** Colunas do modelo CSV (o `field` dos avisos). */
export type LegacyColumn = 'nome' | 'celular' | 'data_compra' | 'descricao' | 'valor_total' | 'valor_pago' | 'vencimentos' | 'perfil' | 'observacao';

export const LEGACY_BATCH_STATUS_LABELS: Record<LegacyBatchStatus, string> = {
  DRAFT: 'Rascunho',
  CONFIRMED: 'Confirmado',
  REVERTED: 'Desfeito',
};

export const LEGACY_ROW_STATUS_LABELS: Record<LegacyRowStatus, string> = {
  OK: 'OK',
  WARNING: 'Aviso',
  ERROR: 'Erro',
  IGNORED: 'Ignorada',
};

export const CREDIT_PROFILE_LABELS: Record<CreditProfileCode, string> = {
  NEW: 'Novo',
  REGULAR: 'Regular',
  GOOD: 'Bom',
  EXCELLENT: 'Excelente',
};

export const LIMIT_RULE_LABELS: Record<LegacyLimitRule, string> = {
  MAX_OF_PROFILE_AND_BALANCE: 'O maior entre o limite do perfil e o saldo',
  PROFILE_ONLY: 'Só o limite do perfil',
};

export type LegacyCustomerAction = { kind: 'NEW'; confirmedNew?: boolean } | { kind: 'LINK'; customerId: string } | { kind: 'SAME_AS_ROW'; rowId: string };

export interface LegacySuggestion {
  customerId?: string;
  rowId?: string;
  name: string;
  match: 'SAME' | 'SIMILAR' | 'PHONE';
}

export interface LegacyIssue {
  code: string;
  severity: 'ERROR' | 'WARNING';
  field: LegacyColumn | null;
  message: string;
  details?: Record<string, unknown>;
}

export interface LegacyDueDate {
  date: string;
  amount: number;
}

export interface LegacyRowData {
  name: string;
  phone: string | null;
  purchaseDate: string | null;
  description: string | null;
  total: number;
  paid: number;
  open: number;
  dueDates: LegacyDueDate[] | null;
  profileCode: CreditProfileCode | null;
  notes: string | null;
}

export interface LegacyRow {
  id: string;
  line: number;
  status: LegacyRowStatus;
  /** Colunas como foram digitadas (planilha ou lançamento rápido): mostra o valor inválido para corrigir. */
  raw: Record<LegacyColumn, string>;
  data: LegacyRowData;
  issues: LegacyIssue[];
  customerAction: LegacyCustomerAction;
  /** Vínculo feito pelo sistema (nome idêntico a um único cliente) — pede conferência. */
  autoLinked: boolean;
  suggestions: LegacySuggestion[];
  customerId: string | null;
  financialDocumentId: string | null;
}

export interface LegacyBatchSummary {
  newCustomers: number;
  existingCustomers: number;
  openTotal: number;
  rows: number;
  warnings: number;
  errors: number;
  ignored: number;
}

export interface LegacyBatchListItem {
  id: string;
  status: LegacyBatchStatus;
  source: LegacyBatchSource;
  fileName: string | null;
  createdAt: string;
  createdBy: { id: string; name: string } | null;
  summary: LegacyBatchSummary;
  limitRule: LegacyLimitRule;
  confirmedAt: string | null;
  revertedAt: string | null;
}

export interface LegacyBatch extends LegacyBatchListItem {
  rows: LegacyRow[];
}

export interface LegacyBatchListResponse {
  data: LegacyBatchListItem[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

/** PATCH de uma linha: só os campos alterados. */
export interface LegacyRowDataInput {
  name?: string;
  phone?: string | null;
  purchaseDate?: string | null;
  description?: string | null;
  total?: number;
  paid?: number;
  dueDates?: LegacyDueDate[] | null;
  profileCode?: CreditProfileCode | null;
  notes?: string | null;
}

export interface UpdateLegacyRowInput {
  data?: LegacyRowDataInput;
  customerAction?: { kind: 'NEW' } | { kind: 'LINK'; customerId: string } | { kind: 'SAME_AS_ROW'; rowId: string };
  ignored?: boolean;
}

export interface QuickEntryDebt {
  amount: number;
  purchaseDate?: string;
  notes?: string;
}

export interface AddLegacyRowsInput {
  customer: { existingId: string } | { name: string; phone?: string | null };
  debts: QuickEntryDebt[];
}

/** Origem do lote para a tela: nome do arquivo ou "Lançamento rápido". */
export function batchLabel(batch: Pick<LegacyBatchListItem, 'source' | 'fileName'>): string {
  return batch.source === 'CSV' ? (batch.fileName ?? 'Planilha CSV') : 'Lançamento rápido';
}

/** Linha vinculada a um cliente que foi excluído depois do vínculo (erro da revisão). */
export function hasMissingLinkedCustomer(row: LegacyRow): boolean {
  return row.issues.some((issue) => issue.code === 'LINKED_CUSTOMER_MISSING');
}

/** Linha com nome parecido ainda sem decisão (o servidor só emite SIMILAR_* enquanto a decisão está pendente). */
export function hasPendingSimilar(row: LegacyRow): boolean {
  return row.status !== 'IGNORED' && row.issues.some((issue) => issue.code === 'SIMILAR_CUSTOMER' || issue.code === 'SIMILAR_ROW');
}
