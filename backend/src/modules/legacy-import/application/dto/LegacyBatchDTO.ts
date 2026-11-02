import type { BatchSummary, CustomerAction, LegacySuggestion, ReviewedRow } from "../../domain/legacyBatchReview";
import type { LegacyIssue } from "../../domain/legacyRow";
import type { BatchListItem } from "../contracts/LegacyImportBatchRepository";
import { fromCents } from "@shared/domain/money";

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

export interface LegacyRowDTO {
  id: string;
  line: number;
  status: string;
  data: LegacyRowDataDTO;
  issues: LegacyIssue[];
  customerAction: CustomerAction;
  suggestions: LegacySuggestion[];
}

export interface LegacyBatchListItemDTO {
  id: string;
  status: string;
  source: string;
  fileName: string | null;
  createdAt: string;
  createdBy: { id: string; name: string } | null;
  summary: BatchSummary;
}

export interface LegacyBatchDTO extends LegacyBatchListItemDTO {
  rows: LegacyRowDTO[];
}

export function toRowDTO(r: ReviewedRow): LegacyRowDTO {
  const d = r.data;
  return {
    id: r.id,
    line: r.line,
    status: r.status,
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
    customerAction: r.customerAction,
    suggestions: r.suggestions,
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
});
