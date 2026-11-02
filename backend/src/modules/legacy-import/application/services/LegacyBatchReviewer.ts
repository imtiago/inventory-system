import { todayInBusinessTz } from "@shared/domain/businessDate";
import { reviewBatch, type BatchSummary, type ReviewedRow } from "../../domain/legacyBatchReview";
import type {
  NewRow,
  LegacyCustomerLookup,
  LegacyImportBatchRepository,
  RowChange,
  StoredRow,
} from "../contracts/LegacyImportBatchRepository";

export interface LegacyReviewResult {
  rows: ReviewedRow[];
  summary: BatchSummary;
  /** customerId → nome no cadastro (para a tela mostrar a quem a linha está vinculada, à parte do nome digitado). */
  linkedNames: Map<string, string>;
}

/**
 * Revalida o lote inteiro: erros e avisos de cada linha, nomes parecidos (clientes e linhas do lote),
 * decisões e resumo. Os clientes são lidos uma vez por chamada.
 */
export class LegacyBatchReviewer {
  constructor(
    private readonly batches: LegacyImportBatchRepository,
    private readonly customers: LegacyCustomerLookup,
  ) {}

  /** Só calcula (leitura): não grava. `fresh` = linhas novas, que podem nascer vinculadas a um cliente idêntico. */
  async review(rows: StoredRow[], fresh: ReadonlySet<string> = new Set()): Promise<LegacyReviewResult> {
    const candidates = await this.customers.candidates(rows.map((r) => r.raw.nome ?? ""));
    const linked = rows.flatMap((r) => (r.customerAction.kind === "LINK" ? [r.customerAction.customerId] : []));
    const present = await this.customers.namesOf(linked);
    const missing = new Set(linked.filter((id) => !present.has(id)));
    const result = reviewBatch(
      rows.map((r) => ({
        id: r.id,
        line: r.line,
        raw: r.raw,
        ignored: r.status === "IGNORED",
        customerAction: r.customerAction,
        fresh: fresh.has(r.id),
      })),
      candidates,
      todayInBusinessTz(),
      missing,
    );
    // Nome do cadastro de cada cliente vinculado (inclusive vínculo automático criado agora).
    const names = new Map(present);
    for (const c of candidates) names.set(c.id, c.name);
    const linkedNames = new Map<string, string>();
    for (const r of result.rows) if (r.customerId && names.has(r.customerId)) linkedNames.set(r.customerId, names.get(r.customerId)!);
    return { ...result, linkedNames };
  }

  /**
   * Recalcula e grava só o que mudou, mais o resumo. Exige a trava do lote (transação).
   * `inserts`: linhas novas, revisadas junto com as gravadas e inseridas já com o resultado (uma escrita só).
   */
  async reviewAndSave(
    batchId: string,
    fresh: ReadonlySet<string> = new Set(),
    inserts: NewRow[] = [],
  ): Promise<LegacyReviewResult> {
    const stored = await this.batches.rows(batchId);
    const pending: StoredRow[] = inserts.map((r) => ({
      id: r.id,
      line: r.line,
      raw: r.raw,
      data: null as unknown as StoredRow["data"],
      issues: [],
      status: "OK",
      customerAction: r.customerAction,
      customerId: null,
      financialDocumentId: null,
    }));
    const result = await this.review([...stored, ...pending], fresh);
    const before = new Map(stored.map((r) => [r.id, r]));
    const inserted = new Set(inserts.map((r) => r.id));
    const changes: RowChange[] = [];
    const toInsert: ReviewedRow[] = [];
    for (const r of result.rows) {
      if (inserted.has(r.id)) {
        toInsert.push(r);
        continue;
      }
      const old = before.get(r.id)!;
      const same =
        old.status === r.status &&
        JSON.stringify(old.data) === JSON.stringify(r.data) &&
        JSON.stringify(old.customerAction) === JSON.stringify(r.customerAction) &&
        JSON.stringify(old.issues) === JSON.stringify(r.issues) &&
        old.customerId === r.customerId;
      if (!same) {
        changes.push({ id: r.id, data: r.data, issues: r.issues, status: r.status, customerAction: r.customerAction, customerId: r.customerId });
      }
    }
    if (toInsert.length > 0) {
      await this.batches.insertRows(
        batchId,
        toInsert.map((r) => ({
          id: r.id,
          line: r.line,
          raw: r.raw,
          data: r.data,
          issues: r.issues,
          status: r.status,
          customerAction: r.customerAction,
          customerId: r.customerId,
        })),
      );
    }
    await this.batches.updateRows(changes);
    await this.batches.saveSummary(batchId, result.summary);
    return result;
  }
}
