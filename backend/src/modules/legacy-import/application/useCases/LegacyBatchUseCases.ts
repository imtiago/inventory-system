import { randomUUID } from "node:crypto";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import type { TransactionManager } from "@shared/application/transaction/TransactionManager";
import type { PaginatedResult } from "@shared/application/dtos/PaginatedResult";
import { decodeCsvBytes, LEGACY_COLUMNS, mapHeader, parseCsv } from "../../domain/csvReader";
import { emptyRaw, type CustomerAction } from "../../domain/legacyBatchReview";
import { applyRowInput, type LegacyRowDataInput } from "../../domain/legacyRowInput";
import {
  legacyBatchNotDraft,
  legacyBatchNotFound,
  legacyCustomerNotFound,
  legacyFileEmpty,
  legacyInvalidTarget,
  legacyRowNotFound,
  legacyTooManyRows,
  MAX_BATCH_ROWS,
} from "../../domain/legacyErrors";
import type {
  LegacyCustomerLookup,
  LegacyImportBatchReadRepository,
  LegacyImportBatchRepository,
  NewRow,
} from "../contracts/LegacyImportBatchRepository";
import type { LegacyBatchReviewer } from "../services/LegacyBatchReviewer";
import { toListItemDTO, toRowDTO, type LegacyBatchDTO, type LegacyBatchListItemDTO } from "../dto/LegacyBatchDTO";

export interface LegacyBatchDeps {
  batches: LegacyImportBatchRepository;
  reads: LegacyImportBatchReadRepository;
  customers: LegacyCustomerLookup;
  reviewer: LegacyBatchReviewer;
}

/** Trava o lote (primeira trava de toda escrita no lote) e exige rascunho. */
async function lockDraft(batches: LegacyImportBatchRepository, id: string): Promise<void> {
  const batch = await batches.lockById(id);
  if (!batch) throw legacyBatchNotFound();
  if (batch.status !== "DRAFT") throw legacyBatchNotDraft();
}

async function toBatchDTO(
  reads: LegacyImportBatchReadRepository,
  id: string,
  result: Awaited<ReturnType<LegacyBatchReviewer["review"]>>,
): Promise<LegacyBatchDTO> {
  const header = await reads.header(id);
  if (!header) throw legacyBatchNotFound();
  return { ...toListItemDTO(header), summary: result.summary, rows: result.rows.map((r) => toRowDTO(r)) };
}

/** Lote como está gravado (confirmado ou desfeito): linhas, avisos e decisões da confirmação, sem sugestões. */
export async function storedBatchDTO(deps: Pick<LegacyBatchDeps, "batches" | "reads">, id: string): Promise<LegacyBatchDTO> {
  const header = await deps.reads.header(id);
  if (!header) throw legacyBatchNotFound();
  const rows = await deps.batches.rows(id);
  return {
    ...toListItemDTO(header),
    rows: rows.map((r) =>
      toRowDTO(
        {
          id: r.id,
          line: r.line,
          raw: r.raw,
          data: r.data,
          issues: r.issues,
          status: r.status,
          customerAction: r.customerAction,
          suggestions: [],
          customerId: r.customerId,
        },
        { customerId: r.customerId, financialDocumentId: r.financialDocumentId },
      ),
    ),
  };
}

/** Revisa o lote com as linhas novas e as insere já revisadas (uma escrita por linha). Linhas `NEW` podem nascer vinculadas. */
async function addRows(deps: LegacyBatchDeps, batchId: string, rows: NewRow[]): Promise<LegacyBatchDTO> {
  const current = await deps.batches.countRows(batchId);
  if (current + rows.length > MAX_BATCH_ROWS) throw legacyTooManyRows();
  const fresh = new Set(rows.filter((r) => r.customerAction.kind === "NEW").map((r) => r.id));
  const result = await deps.reviewer.reviewAndSave(batchId, fresh, rows);
  return toBatchDTO(deps.reads, batchId, result);
}

export class UploadLegacyCsvUseCase extends TransactionalUseCase<
  { bytes: Uint8Array; fileName: string | null; userId: string | null },
  LegacyBatchDTO
> {
  constructor(private readonly deps: LegacyBatchDeps, tm: TransactionManager) {
    super(tm);
  }

  protected async handle(req: { bytes: Uint8Array; fileName: string | null; userId: string | null }) {
    const { header, rows } = parseCsv(decodeCsvBytes(req.bytes));
    const map = mapHeader(header);
    if (rows.length === 0) throw legacyFileEmpty();
    const newRows: NewRow[] = rows.map((r) => {
      const raw = emptyRaw();
      for (const col of LEGACY_COLUMNS) {
        const idx = map[col];
        raw[col] = idx === null ? "" : (r.cells[idx] ?? "").trim();
      }
      return { id: randomUUID(), line: r.line, raw, customerAction: { kind: "NEW" } };
    });
    const id = await this.deps.batches.create({ source: "CSV", fileName: req.fileName, createdById: req.userId });
    await this.deps.batches.lockById(id);
    return addRows(this.deps, id, newRows);
  }
}

export class CreateManualLegacyBatchUseCase extends TransactionalUseCase<{ userId: string | null }, LegacyBatchDTO> {
  constructor(private readonly deps: LegacyBatchDeps, tm: TransactionManager) {
    super(tm);
  }

  protected async handle(req: { userId: string | null }) {
    const id = await this.deps.batches.create({ source: "MANUAL", fileName: null, createdById: req.userId });
    const result = await this.deps.reviewer.reviewAndSave(id);
    return toBatchDTO(this.deps.reads, id, result);
  }
}

export interface AddLegacyRowsRequest {
  batchId: string;
  customer: { existingId: string } | { name: string; phone?: string | null };
  debts: {
    amount: number;
    paid?: number;
    purchaseDate?: string;
    description?: string;
    notes?: string;
    dueDates?: { date: string; amount: number }[];
  }[];
}

export class AddLegacyRowsUseCase extends TransactionalUseCase<AddLegacyRowsRequest, LegacyBatchDTO> {
  constructor(private readonly deps: LegacyBatchDeps, tm: TransactionManager) {
    super(tm);
  }

  protected async handle(req: AddLegacyRowsRequest) {
    await lockDraft(this.deps.batches, req.batchId);
    let name: string;
    let phone: string | null = null;
    let linkId: string | null = null;
    if ("existingId" in req.customer) {
      const customer = await this.deps.customers.get(req.customer.existingId);
      if (!customer) throw legacyCustomerNotFound();
      ({ name, phone } = customer);
      linkId = customer.id;
    } else {
      name = req.customer.name;
      phone = req.customer.phone ?? null;
    }
    const base = await this.deps.batches.maxLine(req.batchId);
    const ids = req.debts.map(() => randomUUID());
    const rows: NewRow[] = req.debts.map((d, i) => {
      const input: LegacyRowDataInput = {
        name,
        phone,
        total: d.amount,
        paid: d.paid ?? 0,
        purchaseDate: d.purchaseDate ?? null,
        description: d.description ?? null,
        notes: d.notes ?? null,
        dueDates: d.dueDates ?? null,
      };
      // Mesmo cliente em todas as dívidas do lançamento: cadastro existente, ou a 1ª linha.
      const customerAction: CustomerAction = linkId
        ? { kind: "LINK", customerId: linkId }
        : i === 0
          ? { kind: "NEW" }
          : { kind: "SAME_AS_ROW", rowId: ids[0] };
      return { id: ids[i], line: base + 1 + i, raw: applyRowInput(emptyRaw(), input), customerAction };
    });
    return addRows(this.deps, req.batchId, rows);
  }
}

export interface UpdateLegacyRowRequest {
  batchId: string;
  rowId: string;
  data?: LegacyRowDataInput;
  customerAction?: { kind: "NEW" } | { kind: "LINK"; customerId: string } | { kind: "SAME_AS_ROW"; rowId: string };
  ignored?: boolean;
}

export class UpdateLegacyRowUseCase extends TransactionalUseCase<UpdateLegacyRowRequest, LegacyBatchDTO> {
  constructor(private readonly deps: LegacyBatchDeps, tm: TransactionManager) {
    super(tm);
  }

  protected async handle(req: UpdateLegacyRowRequest) {
    const { batches, customers } = this.deps;
    await lockDraft(batches, req.batchId);
    const rows = await batches.rows(req.batchId);
    const row = rows.find((r) => r.id === req.rowId);
    if (!row) throw legacyRowNotFound();

    let action: CustomerAction = row.customerAction;
    // FK do cliente: a coluna gravada (null se o cliente vinculado foi apagado) ou o cliente escolhido agora.
    let customerId: string | null = row.customerAction.kind === "LINK" ? row.customerId : null;
    const wanted = req.customerAction;
    if (wanted) {
      customerId = null;
      if (wanted.kind === "NEW") action = { kind: "NEW", confirmedNew: true };
      else if (wanted.kind === "LINK") {
        if (!(await customers.exists(wanted.customerId))) throw legacyCustomerNotFound();
        action = { kind: "LINK", customerId: wanted.customerId };
        customerId = wanted.customerId;
      } else {
        const byId = new Map(rows.map((r) => [r.id, r]));
        const target = byId.get(wanted.rowId);
        if (!target) throw legacyRowNotFound();
        if (target.id === row.id || target.status === "IGNORED") throw legacyInvalidTarget();
        // Sem ciclo: a cadeia do alvo não pode voltar a esta linha.
        let cursor = target;
        for (let hops = 0; hops <= rows.length && cursor.customerAction.kind === "SAME_AS_ROW"; hops++) {
          const next = byId.get(cursor.customerAction.rowId);
          if (!next) break;
          if (next.id === row.id) throw legacyInvalidTarget();
          cursor = next;
        }
        action = wanted;
      }
    }

    const ignored = req.ignored ?? row.status === "IGNORED";
    await batches.updateRows([
      {
        id: row.id,
        raw: req.data ? applyRowInput(row.raw, req.data) : row.raw,
        data: row.data,
        issues: row.issues,
        // Provisória: a revisão abaixo recalcula (a situação IGNORED é a marca de "ignorada").
        status: ignored ? "IGNORED" : "OK",
        customerAction: action,
        customerId,
      },
    ]);
    const result = await this.deps.reviewer.reviewAndSave(req.batchId);
    return toBatchDTO(this.deps.reads, req.batchId, result);
  }
}

export class GetLegacyBatchUseCase {
  constructor(private readonly deps: LegacyBatchDeps) {}

  async execute(id: string): Promise<LegacyBatchDTO> {
    const header = await this.deps.reads.header(id);
    if (!header) throw legacyBatchNotFound();
    // Confirmado/desfeito: mostra o que foi gravado, sem reavaliar contra os clientes de agora.
    if (header.status !== "DRAFT") return storedBatchDTO(this.deps, id);
    const stored = await this.deps.batches.rows(id);
    const result = await this.deps.reviewer.review(stored);
    return toBatchDTO(this.deps.reads, id, result);
  }
}

export class ListLegacyBatchesUseCase {
  constructor(private readonly reads: LegacyImportBatchReadRepository) {}

  async execute(q: { page: number; limit: number }): Promise<PaginatedResult<LegacyBatchListItemDTO>> {
    const { items, total } = await this.reads.list(q.page, q.limit);
    return {
      data: items.map(toListItemDTO),
      pagination: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) },
    };
  }
}

export class DeleteLegacyDraftUseCase extends TransactionalUseCase<{ id: string }, void> {
  constructor(private readonly batches: LegacyImportBatchRepository, tm: TransactionManager) {
    super(tm);
  }

  protected async handle(req: { id: string }) {
    await lockDraft(this.batches, req.id);
    await this.batches.delete(req.id);
  }
}
