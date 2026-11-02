import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import type { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { InternalErrorCodes, InternalInvariantError } from "@shared/domain/errors";
import { FinancialStatus } from "@finance/domain/enums/FinancialStatus";
import type { FinancialDocumentRepository } from "@finance/domain/repositories/FinancialDocumentRepository";
import {
  legacyBatchHasPayments,
  legacyBatchNotConfirmed,
  legacyBatchNotFound,
} from "../../domain/legacyErrors";
import type { LegacyBatchDTO } from "../dto/LegacyBatchDTO";
import { storedBatchDTO, type LegacyBatchDeps } from "./LegacyBatchUseCases";

export interface RevertLegacyBatchDeps extends Pick<LegacyBatchDeps, "batches" | "reads" | "customers"> {
  documents: Pick<FinancialDocumentRepository, "lockById" | "hasPayments" | "update">;
}

/**
 * Desfaz um lote confirmado. Travas: lote (FOR UPDATE) → dívidas do lote (FOR UPDATE, ORDER BY id).
 * Pagamento ativo em qualquer uma → 409 LEGACY_BATCH_HAS_PAYMENTS (nada muda). Senão cancela todas e o
 * lote vira REVERTED. Clientes criados, perfis e limites ficam como a confirmação deixou (histórico preservado).
 */
export class RevertLegacyBatchUseCase extends TransactionalUseCase<{ batchId: string; userId: string | null }, LegacyBatchDTO> {
  constructor(private readonly deps: RevertLegacyBatchDeps, tm: TransactionManager) {
    super(tm);
  }

  protected async handle(req: { batchId: string; userId: string | null }): Promise<LegacyBatchDTO> {
    const { batches, documents } = this.deps;
    const batch = await batches.lockById(req.batchId);
    if (!batch) throw legacyBatchNotFound();
    if (batch.status !== "CONFIRMED") throw legacyBatchNotConfirmed();

    const ids = (await batches.rows(req.batchId))
      .map((r) => r.financialDocumentId)
      .filter((id): id is string => id !== null)
      .sort();
    const locked = [];
    for (const id of ids) {
      const document = await documents.lockById(id);
      if (!document) {
        throw new InternalInvariantError(`Dívida ${id} do lote não encontrada.`, InternalErrorCodes.FINANCIAL_DOCUMENT_NOT_CANCELABLE);
      }
      locked.push(document);
    }
    if (await documents.hasPayments(ids)) throw legacyBatchHasPayments();

    const toCancel = locked.filter((d) => d.status !== FinancialStatus.CANCELED);
    for (const document of toCancel) document.cancel();
    for (const document of toCancel) await documents.update(document);

    await batches.markReverted(req.batchId, req.userId);
    return storedBatchDTO(this.deps, req.batchId);
  }
}
