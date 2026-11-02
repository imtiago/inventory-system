import type { BatchSummary, CustomerAction, CustomerCandidate, LegacyRawRow, RowStatus } from "../../domain/legacyBatchReview";
import type { LegacyIssue, LegacyRowData } from "../../domain/legacyRow";

export type LegacyBatchStatus = "DRAFT" | "CONFIRMED" | "REVERTED";
export type LegacyBatchSource = "CSV" | "MANUAL";

export interface StoredRow {
  id: string;
  line: number;
  raw: LegacyRawRow;
  data: LegacyRowData;
  issues: LegacyIssue[];
  status: RowStatus;
  customerAction: CustomerAction;
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
  /** Insere linhas com validação inicial (a revisão do lote refina em seguida). */
  insertRows(batchId: string, rows: (NewRow & Omit<RowChange, "id" | "customerAction" | "raw">)[]): Promise<void>;
  updateRows(changes: RowChange[]): Promise<void>;
  saveSummary(batchId: string, summary: BatchSummary): Promise<void>;
  delete(id: string): Promise<void>;
}

/** Clientes cadastrados para a comparação de nomes. */
export interface LegacyCustomerLookup {
  /** Todos (nome, celular); acima de `LARGE_STORE` clientes, só os que dividem algum termo com os nomes dados. */
  candidates(names: string[]): Promise<CustomerCandidate[]>;
  exists(id: string): Promise<boolean>;
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
}

export interface BatchHeader extends BatchListItem {}

export interface LegacyImportBatchReadRepository {
  list(page: number, limit: number): Promise<{ items: BatchListItem[]; total: number }>;
  header(id: string): Promise<BatchHeader | null>;
}
