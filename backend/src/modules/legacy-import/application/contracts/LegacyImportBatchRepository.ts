import type { BatchSummary, CustomerAction, CustomerCandidate, LegacyRawRow, RowStatus } from "../../domain/legacyBatchReview";
import type { LegacyIssue, LegacyRowData } from "../../domain/legacyRow";

export type LegacyBatchStatus = "DRAFT" | "CONFIRMED" | "REVERTED";
export type LegacyBatchSource = "CSV" | "MANUAL";
/** Regra do limite na confirmação: maior entre limite atual, limite inicial do perfil e saldo; ou só o do perfil. */
export type LegacyLimitRule = "MAX_OF_PROFILE_AND_BALANCE" | "PROFILE_ONLY";

export interface StoredRow {
  id: string;
  line: number;
  raw: LegacyRawRow;
  data: LegacyRowData;
  issues: LegacyIssue[];
  status: RowStatus;
  customerAction: CustomerAction;
  /** Cliente da linha (vínculo no rascunho; o criado/vinculado depois de confirmar). */
  customerId: string | null;
  /** Dívida criada na confirmação. */
  financialDocumentId: string | null;
}

export interface NewRow {
  id: string;
  line: number;
  raw: LegacyRawRow;
  customerAction: CustomerAction;
}

export interface RowChange {
  id: string;
  data: LegacyRowData;
  issues: LegacyIssue[];
  status: RowStatus;
  customerAction: CustomerAction;
  /** Valor da FK do cliente: só um cliente vinculado que existe (vínculo para cliente apagado grava null). */
  customerId: string | null;
  raw?: LegacyRawRow;
}

export interface LockedBatch {
  id: string;
  status: LegacyBatchStatus;
}

export interface LegacyImportBatchRepository {
  create(input: { source: LegacyBatchSource; fileName: string | null; createdById: string | null }): Promise<string>;
  /** `FOR UPDATE`; exige transação. É a primeira trava de qualquer escrita no lote. */
  lockById(id: string): Promise<LockedBatch | null>;
  rows(batchId: string): Promise<StoredRow[]>;
  maxLine(batchId: string): Promise<number>;
  countRows(batchId: string): Promise<number>;
  /** Insere linhas já revisadas (`customerId`: FK do cliente vinculado que existe). */
  insertRows(batchId: string, rows: (NewRow & Omit<RowChange, "id" | "customerAction" | "raw">)[]): Promise<void>;
  updateRows(changes: RowChange[]): Promise<void>;
  saveSummary(batchId: string, summary: BatchSummary): Promise<void>;
  delete(id: string): Promise<void>;
  /** Grava o cliente e a dívida criados para a linha na confirmação. */
  markRowImported(rowId: string, customerId: string, financialDocumentId: string): Promise<void>;
  markConfirmed(batchId: string, input: { userId: string | null; limitRule: LegacyLimitRule }): Promise<void>;
  markReverted(batchId: string, userId: string | null): Promise<void>;
}

/** Clientes cadastrados para a comparação de nomes. */
export interface LegacyCustomerLookup {
  /** Todos (nome, celular); acima de `LARGE_STORE` clientes, só os que dividem algum termo com os nomes dados. */
  candidates(names: string[]): Promise<CustomerCandidate[]>;
  exists(id: string): Promise<boolean>;
  /** Quais destes ids ainda existem. */
  existing(ids: string[]): Promise<Set<string>>;
  get(id: string): Promise<CustomerCandidate | null>;
}

export interface BatchListItem {
  id: string;
  status: LegacyBatchStatus;
  source: LegacyBatchSource;
  fileName: string | null;
  createdAt: Date;
  createdBy: { id: string; name: string } | null;
  summary: BatchSummary;
  limitRule: LegacyLimitRule;
  confirmedAt: Date | null;
  revertedAt: Date | null;
}

export interface BatchHeader extends BatchListItem {}

export interface LegacyImportBatchReadRepository {
  list(page: number, limit: number): Promise<{ items: BatchListItem[]; total: number }>;
  header(id: string): Promise<BatchHeader | null>;
}
