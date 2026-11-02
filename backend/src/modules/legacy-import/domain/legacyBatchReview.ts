// Revisão do lote inteira, pura: revalida cada linha, recalcula os avisos de nomes parecidos
// (clientes existentes e linhas anteriores do lote), normaliza as decisões e monta o resumo.
import type { LegacyColumn } from "./legacyTemplate";
import { LEGACY_COLUMNS } from "./legacyTemplate";
import { validateLegacyRow, type LegacyIssue, type LegacyRowData } from "./legacyRow";
import { normalizeName, SimilarityIndex, type SimilarMatch } from "./nameSimilarity";

export type LegacyRawRow = Record<LegacyColumn, string>;

/**
 * Decisão da usuária sobre quem é o cliente da linha. `confirmedNew`: "é outra pessoa", decidido de propósito.
 * `auto`: vínculo feito pelo sistema (nome idêntico a um único cliente) — a tela pede conferência.
 */
export type CustomerAction =
  | { kind: "NEW"; confirmedNew?: boolean }
  | { kind: "LINK"; customerId: string; auto?: true }
  | { kind: "SAME_AS_ROW"; rowId: string };

export type RowStatus = "OK" | "WARNING" | "ERROR" | "IGNORED";

export interface LegacySuggestion {
  customerId?: string;
  rowId?: string;
  name: string;
  match: SimilarMatch;
}

export interface ReviewRowInput {
  id: string;
  line: number;
  raw: LegacyRawRow;
  ignored: boolean;
  customerAction: CustomerAction;
  /** Linha recém-criada: um único cliente com nome idêntico já vira vínculo (a usuária pode trocar). */
  fresh?: boolean;
  /** "Importar mesmo assim": a usuária confirmou que não é a mesma dívida já importada. */
  acceptDuplicate?: boolean;
}

export interface ReviewedRow {
  id: string;
  line: number;
  /** Colunas como foram digitadas (CSV ou lançamento rápido), para a tela mostrar valores inválidos. */
  raw: LegacyRawRow;
  data: LegacyRowData;
  issues: LegacyIssue[];
  status: RowStatus;
  customerAction: CustomerAction;
  suggestions: LegacySuggestion[];
  /** Cliente vinculado que ainda existe (null: novo, mesma pessoa de outra linha ou vínculo para cliente apagado). */
  customerId: string | null;
  acceptDuplicate: boolean;
}

/** Dívida do caderninho já gravada (lote confirmado, documento em aberto), para achar importação repetida. */
export interface ExistingLegacyDebt {
  customerId: string;
  openCents: number;
  batchId: string;
  line: number;
  financialDocumentId: string;
}

export interface BatchSummary {
  newCustomers: number;
  existingCustomers: number;
  /** Reais. */
  openTotal: number;
  rows: number;
  warnings: number;
  errors: number;
  ignored: number;
}

export interface CustomerCandidate {
  id: string;
  name: string;
  phone: string | null;
}

export const emptyRaw = (): LegacyRawRow =>
  Object.fromEntries(LEGACY_COLUMNS.map((c) => [c, ""])) as LegacyRawRow;

/** Raiz da cadeia SAME_AS_ROW (linha-alvo válida: existe, não ignorada, sem ciclo) ou null. */
function resolveRoot(
  rowId: string,
  actions: Map<string, CustomerAction>,
  ignored: Map<string, boolean>,
): string | null {
  let current = rowId;
  for (let hops = 0; hops <= actions.size; hops++) {
    const action = actions.get(current);
    if (!action || ignored.get(current)) return null;
    if (action.kind !== "SAME_AS_ROW") return current;
    current = action.rowId;
  }
  return null;
}

export const LINKED_CUSTOMER_MISSING_MESSAGE =
  'O cliente vinculado não existe mais (foi excluído). Escolha "Criar novo" ou vincule outro cliente.';

/**
 * `missingCustomerIds`: clientes vinculados (LINK) que não existem mais — a linha vira ERROR
 * `LINKED_CUSTOMER_MISSING` e não grava o vínculo (a FK do cliente da linha não aceitaria).
 */
export function reviewBatch(
  inputs: ReviewRowInput[],
  customers: CustomerCandidate[],
  today: string,
  missingCustomerIds: ReadonlySet<string> = new Set(),
): { rows: ReviewedRow[]; summary: BatchSummary } {
  const sorted = [...inputs].sort((a, b) => a.line - b.line || a.id.localeCompare(b.id));
  const customerName = new Map(customers.map((c) => [c.id, c.name]));

  // 1) validação por linha
  const validated = sorted.map((r) => ({ input: r, ...validateLegacyRow(r.raw, today) }));

  // 2) sugestões (clientes normalizados uma vez, por inicial; linhas anteriores entram no índice aos poucos)
  const customerIndex = new SimilarityIndex(customers);
  const rowIndex = new SimilarityIndex();
  const nameOfRow = new Map<string, string>();
  const suggestionsOf = new Map<string, LegacySuggestion[]>();
  for (const v of validated) {
    const list: LegacySuggestion[] = [];
    if (!v.input.ignored && v.data.name !== "") {
      const tokens = normalizeName(v.data.name);
      for (const m of customerIndex.find(tokens, v.data.phone)) {
        list.push({ customerId: m.id, name: customerName.get(m.id) ?? "", match: m.match });
      }
      for (const m of rowIndex.find(tokens, v.data.phone)) {
        list.push({ rowId: m.id, name: nameOfRow.get(m.id) ?? "", match: m.match });
      }
      rowIndex.add(v.input.id, tokens, v.data.phone);
      nameOfRow.set(v.input.id, v.data.name);
    }
    suggestionsOf.set(v.input.id, list);
  }

  // 3) decisões válidas
  const rawActions = new Map<string, CustomerAction>();
  const ignoredMap = new Map<string, boolean>();
  for (const v of validated) {
    let action = v.input.customerAction;
    const sameCustomer = (suggestionsOf.get(v.input.id) ?? []).filter(
      (s) => s.customerId !== undefined && s.match === "SAME",
    );
    if (v.input.fresh && action.kind === "NEW" && sameCustomer.length === 1) {
      action = { kind: "LINK", customerId: sameCustomer[0].customerId!, auto: true };
    }
    rawActions.set(v.input.id, action);
    ignoredMap.set(v.input.id, v.input.ignored);
  }
  const finalActions = new Map<string, CustomerAction>();
  for (const v of validated) {
    const action = rawActions.get(v.input.id)!;
    if (action.kind === "SAME_AS_ROW") {
      const root = action.rowId === v.input.id ? null : resolveRoot(action.rowId, rawActions, ignoredMap);
      finalActions.set(v.input.id, root && root !== v.input.id ? { kind: "SAME_AS_ROW", rowId: root } : { kind: "NEW" });
    } else finalActions.set(v.input.id, action);
  }

  // 4) avisos de nomes parecidos (só decisão pendente) e situação
  const rows: ReviewedRow[] = validated.map((v) => {
    const action = finalActions.get(v.input.id)!;
    const suggestions = suggestionsOf.get(v.input.id) ?? [];
    const issues = [...v.issues];
    const linkMissing = action.kind === "LINK" && missingCustomerIds.has(action.customerId);
    if (linkMissing && !v.input.ignored) {
      issues.push({ code: "LINKED_CUSTOMER_MISSING", severity: "ERROR", field: "nome", message: LINKED_CUSTOMER_MISSING_MESSAGE });
    }
    const pending = action.kind === "NEW" && !action.confirmedNew && !v.input.ignored;
    if (pending) {
      const customerHits = suggestions.filter((s) => s.customerId !== undefined);
      if (customerHits.length > 0) {
        issues.push({
          code: "SIMILAR_CUSTOMER",
          severity: "WARNING",
          field: "nome",
          message: `Parece cliente já cadastrado: ${customerHits.map((s) => s.name).join(", ")}. Vincule ou confirme como novo.`,
          details: { suggestions: customerHits },
        });
      }
      const rowHits = suggestions.filter((s) => s.rowId !== undefined);
      if (rowHits.length > 0) {
        issues.push({
          code: "SIMILAR_ROW",
          severity: "WARNING",
          field: "nome",
          message: `Parece a mesma pessoa de outra linha: ${rowHits.map((s) => s.name).join(", ")}. Junte ou confirme como outra pessoa.`,
          details: { suggestions: rowHits },
        });
      }
    }
    const status: RowStatus = v.input.ignored
      ? "IGNORED"
      : issues.some((i) => i.severity === "ERROR")
        ? "ERROR"
        : issues.length > 0
          ? "WARNING"
          : "OK";
    return {
      id: v.input.id,
      line: v.input.line,
      raw: v.input.raw,
      data: v.data,
      issues,
      status,
      customerAction: action,
      suggestions,
      customerId: action.kind === "LINK" && !linkMissing ? action.customerId : null,
      acceptDuplicate: v.input.acceptDuplicate === true,
    };
  });

  // 5) resumo
  const newKeys = new Set<string>();
  const existingKeys = new Set<string>();
  let openCents = 0;
  const summary: BatchSummary = { newCustomers: 0, existingCustomers: 0, openTotal: 0, rows: rows.length, warnings: 0, errors: 0, ignored: 0 };
  const byId = new Map(rows.map((r) => [r.id, r]));
  for (const r of rows) {
    if (r.status === "IGNORED") {
      summary.ignored++;
      continue;
    }
    if (r.status === "ERROR") summary.errors++;
    if (r.status === "WARNING") summary.warnings++;
    openCents += r.data.openCents;
    const a = r.customerAction;
    const target = a.kind === "SAME_AS_ROW" ? (byId.get(a.rowId)?.customerAction ?? a) : a;
    if (target.kind === "LINK") existingKeys.add(target.customerId);
    else newKeys.add(a.kind === "SAME_AS_ROW" ? a.rowId : r.id);
  }
  summary.newCustomers = newKeys.size;
  summary.existingCustomers = existingKeys.size;
  summary.openTotal = openCents / 100;
  return { rows, summary };
}

const brl = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Cliente cadastrado de destino da linha: vínculo direto ou da raiz de SAME_AS_ROW (null: cliente novo). */
export function targetCustomerId(row: ReviewedRow, byId: ReadonlyMap<string, ReviewedRow>): string | null {
  if (row.customerAction.kind === "SAME_AS_ROW") return byId.get(row.customerAction.rowId)?.customerId ?? null;
  return row.customerId;
}

/**
 * Importação repetida: linha cujo cliente cadastrado já tem dívida do caderninho em aberto com o mesmo saldo
 * vira WARNING `POSSIBLE_DUPLICATE_DEBT` com o lote anterior; a confirmação exige decidir ("importar mesmo
 * assim" = `acceptDuplicate`, ou ignorar a linha). Recalcula situação e resumo (avisos). Puro.
 */
export function flagDuplicateDebts(
  review: { rows: ReviewedRow[]; summary: BatchSummary },
  debts: readonly ExistingLegacyDebt[],
): { rows: ReviewedRow[]; summary: BatchSummary } {
  if (debts.length === 0) return review;
  const byCustomer = new Map<string, ExistingLegacyDebt[]>();
  for (const d of debts) {
    const list = byCustomer.get(d.customerId) ?? [];
    list.push(d);
    byCustomer.set(d.customerId, list);
  }
  const byId = new Map(review.rows.map((r) => [r.id, r]));
  const summary = { ...review.summary };
  const rows = review.rows.map((r) => {
    if (r.status === "IGNORED" || r.data.openCents <= 0) return r;
    const customerId = targetCustomerId(r, byId);
    const match = customerId ? (byCustomer.get(customerId) ?? []).find((d) => d.openCents === r.data.openCents) : undefined;
    if (!match) return r;
    const message = r.acceptDuplicate
      ? `Este cliente já tem uma dívida do caderninho de ${brl(match.openCents)} (lote ${match.batchId.slice(0, 8)}, linha ${match.line}). Você escolheu importar mesmo assim.`
      : `Este cliente já tem uma dívida do caderninho de ${brl(match.openCents)} (lote ${match.batchId.slice(0, 8)}, linha ${match.line}). Se for a mesma, ignore a linha; se for outra, importe mesmo assim.`;
    const issues: LegacyIssue[] = [
      ...r.issues,
      {
        code: "POSSIBLE_DUPLICATE_DEBT",
        severity: "WARNING",
        field: null,
        message,
        details: { batchId: match.batchId, line: match.line, financialDocumentId: match.financialDocumentId, accepted: r.acceptDuplicate },
      },
    ];
    const status: RowStatus = r.status === "OK" ? "WARNING" : r.status;
    if (r.status === "OK") summary.warnings++;
    return { ...r, issues, status };
  });
  return { rows, summary };
}

/** Linha com dívida possivelmente repetida ainda sem decisão. */
export const hasUnresolvedDuplicate = (row: ReviewedRow): boolean =>
  row.issues.some((i) => i.code === "POSSIBLE_DUPLICATE_DEBT" && i.details?.accepted !== true);
