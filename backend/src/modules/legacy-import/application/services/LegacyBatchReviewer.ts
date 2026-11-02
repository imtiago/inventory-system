import { todayInBusinessTz } from "@shared/domain/businessDate";
import { reviewBatch, type BatchSummary, type ReviewedRow } from "../../domain/legacyBatchReview";
import type {
  LegacyCustomerLookup,
  LegacyImportBatchRepository,
  RowChange,
  StoredRow,
} from "../contracts/LegacyImportBatchRepository";

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
  async review(rows: StoredRow[], fresh: ReadonlySet<string> = new Set()): Promise<{ rows: ReviewedRow[]; summary: BatchSummary }> {
    const candidates = await this.customers.candidates(rows.map((r) => r.raw.nome ?? ""));
    const linked = rows.flatMap((r) => (r.customerAction.kind === "LINK" ? [r.customerAction.customerId] : []));
    const present = await this.customers.existing(linked);
    const missing = new Set(linked.filter((id) => !present.has(id)));
    return reviewBatch(
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
  }

  /** Recalcula e grava só o que mudou, mais o resumo. Exige a trava do lote (transação). */
  async reviewAndSave(batchId: string, fresh: ReadonlySet<string> = new Set()): Promise<{ rows: ReviewedRow[]; summary: BatchSummary }> {
    const stored = await this.batches.rows(batchId);
    const result = await this.review(stored, fresh);
    const before = new Map(stored.map((r) => [r.id, r]));
    const changes: RowChange[] = [];
    for (const r of result.rows) {
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
    await this.batches.updateRows(changes);
    await this.batches.saveSummary(batchId, result.summary);
    return result;
  }
}
