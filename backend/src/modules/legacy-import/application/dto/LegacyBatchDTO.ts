import type { BatchSummary, CustomerAction, LegacyRawRow, LegacySuggestion, ReviewedRow } from "../../domain/legacyBatchReview";
import type { LegacyIssue } from "../../domain/legacyRow";
import type { BatchListItem } from "../contracts/LegacyImportBatchRepository";
import { fromCents } from "@shared/domain/money";
import { emptyRaw } from "../../domain/legacyBatchReview";

export interface LegacyRowDataDTO {
  name: string;
  phone: string | null;
  purchaseDate: string | null;
  description: string | null;
  total: number;
  paid: number;
  open: number;
  dueDates: { date: string; amount: number }[] | null;
  profileCode: string | null;
  notes: string | null;
}

/** Decisão sobre o cliente como a API devolve (sem a marca interna `auto`; ver `autoLinked`). */
export type CustomerActionDTO =
  | { kind: "NEW"; confirmedNew?: boolean }
  | { kind: "LINK"; customerId: string }
  | { kind: "SAME_AS_ROW"; rowId: string };

export interface LegacyRowDTO {
  id: string;
  line: number;
  status: string;
  /** Colunas como foram digitadas (CSV/lançamento rápido): o editor mostra o valor inválido em vez de campo vazio. */
  raw: LegacyRawRow;
  data: LegacyRowDataDTO;
  issues: LegacyIssue[];
  customerAction: CustomerActionDTO;
  /** Vínculo feito pelo sistema (nome idêntico a um único cliente), não escolhido pela usuária. */
  autoLinked: boolean;
  suggestions: LegacySuggestion[];
  /** Cliente vinculado (rascunho) ou criado/vinculado na confirmação. */
  customerId: string | null;
  /** Nome do cliente `customerId` no cadastro (pode diferir de `data.name`, o nome digitado). */
  linkedCustomerName: string | null;
  /** Dívida criada na confirmação; null no rascunho e em linha ignorada. */
  financialDocumentId: string | null;
}

export interface LegacyBatchListItemDTO {
  id: string;
  status: string;
  source: string;
  fileName: string | null;
  createdAt: string;
  createdBy: { id: string; name: string } | null;
  summary: BatchSummary;
  limitRule: string;
  confirmedAt: string | null;
  revertedAt: string | null;
}

export interface LegacyBatchDTO extends LegacyBatchListItemDTO {
  rows: LegacyRowDTO[];
}

const actionDTO = (a: CustomerAction): CustomerActionDTO =>
  a.kind === "LINK" ? { kind: "LINK", customerId: a.customerId } : a;

export function toRowDTO(
  r: ReviewedRow,
  imported: { customerId: string | null; financialDocumentId: string | null } = {
    customerId: r.customerId,
    financialDocumentId: null,
  },
  linkedNames: ReadonlyMap<string, string> = new Map(),
): LegacyRowDTO {
  const d = r.data;
  return {
    id: r.id,
    line: r.line,
    status: r.status,
    raw: { ...emptyRaw(), ...r.raw },
    data: {
      name: d.name,
      phone: d.phone,
      purchaseDate: d.purchaseDate,
      description: d.description,
      total: fromCents(d.totalCents),
      paid: fromCents(d.paidCents),
      open: fromCents(d.openCents),
      dueDates: d.dueDates ? d.dueDates.map((x) => ({ date: x.date, amount: fromCents(x.amountCents) })) : null,
      profileCode: d.profileCode,
      notes: d.notes,
    },
    issues: r.issues,
    customerAction: actionDTO(r.customerAction),
    autoLinked: r.customerAction.kind === "LINK" && r.customerAction.auto === true,
    suggestions: r.suggestions,
    customerId: imported.customerId,
    linkedCustomerName: imported.customerId ? (linkedNames.get(imported.customerId) ?? null) : null,
    financialDocumentId: imported.financialDocumentId,
  };
}

export const toListItemDTO = (b: BatchListItem): LegacyBatchListItemDTO => ({
  id: b.id,
  status: b.status,
  source: b.source,
  fileName: b.fileName,
  createdAt: b.createdAt.toISOString(),
  createdBy: b.createdBy,
  summary: b.summary,
  limitRule: b.limitRule,
  confirmedAt: b.confirmedAt ? b.confirmedAt.toISOString() : null,
  revertedAt: b.revertedAt ? b.revertedAt.toISOString() : null,
});
