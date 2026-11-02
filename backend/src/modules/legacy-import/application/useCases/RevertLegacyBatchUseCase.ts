import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import type { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { ErrorCodes, NotFoundError } from "@shared/domain/errors";
import { CreditChangeSource } from "@credit/domain/customerCredit";
import type { CustomerCreditRepository } from "@credit/application/contracts/CustomerCreditRepository";
import type { CustomerCreditService } from "@credit/application/services/CustomerCreditService";
import { FinancialStatus } from "@finance/domain/enums/FinancialStatus";
import type { FinancialDocumentRepository } from "@finance/domain/repositories/FinancialDocumentRepository";
import {
  legacyBatchHasPayments,
  legacyBatchNotConfirmed,
  legacyBatchNotFound,
} from "../../domain/legacyErrors";
import { LEGACY_REVERT_REASON, legacyImportReason } from "../../domain/legacyCreditReasons";
import type { LegacyCreditHistory } from "../contracts/LegacyCreditHistory";
import type { LegacyBatchDTO } from "../dto/LegacyBatchDTO";
import { storedBatchDTO, type LegacyBatchDeps } from "./LegacyBatchUseCases";

export interface RevertLegacyBatchDeps extends Pick<LegacyBatchDeps, "batches" | "reads" | "customers"> {
  documents: Pick<FinancialDocumentRepository, "lockById" | "hasPayments" | "update">;
  customerCredits: Pick<CustomerCreditRepository, "lockMany">;
  creditService: Pick<CustomerCreditService, "applyChange">;
  creditHistory: LegacyCreditHistory;
}

export interface CreditRestoreItem {
  customerId: string;
  name: string;
}

export interface RevertLegacyBatchResult extends LegacyBatchDTO {
  /** Fichas que a importação mudou: restauradas (sem mudança desde então) ou mantidas (mudaram depois). */
  creditRestore: { restored: CreditRestoreItem[]; notRestored: CreditRestoreItem[] };
}

/**
 * Desfaz um lote confirmado. Travas: lote (FOR UPDATE) → fichas dos clientes do lote (`lockMany`, ORDER BY id,
 * mesma ordem da confirmação) → dívidas do lote (FOR UPDATE, ORDER BY id). Pagamento ativo em qualquer uma →
 * 409 LEGACY_BATCH_HAS_PAYMENTS (nada muda). Senão cancela todas e o lote vira REVERTED. Clientes ficam.
 * Perfil/limite que a confirmação mudou voltam ao de antes (`applyChange`, LEGACY_IMPORT, "Lote desfeito") só se a
 * ficha ainda está como a importação deixou e não houve outra mudança depois; senão ficam e vão em `notRestored`.
 */
export class RevertLegacyBatchUseCase extends TransactionalUseCase<{ batchId: string; userId: string | null }, RevertLegacyBatchResult> {
  constructor(private readonly deps: RevertLegacyBatchDeps, tm: TransactionManager) {
    super(tm);
  }

  protected async handle(req: { batchId: string; userId: string | null }): Promise<RevertLegacyBatchResult> {
    const { batches, documents } = this.deps;
    const batch = await batches.lockById(req.batchId);
    if (!batch) throw legacyBatchNotFound();
    if (batch.status !== "CONFIRMED") throw legacyBatchNotConfirmed();

    const rows = await batches.rows(req.batchId);
    const customerIds = [...new Set(rows.flatMap((r) => (r.financialDocumentId && r.customerId ? [r.customerId] : [])))];
    const credits = new Map((await this.deps.customerCredits.lockMany(customerIds)).map((c) => [c.customerId, c]));

    const ids = rows
      .map((r) => r.financialDocumentId)
      .filter((id): id is string => id !== null)
      .sort();
    const locked = [];
    for (const id of ids) {
      const document = await documents.lockById(id);
      if (!document) {
        throw new NotFoundError(`Dívida ${id} do lote não encontrada.`, ErrorCodes.FINANCIAL_DOCUMENT_NOT_FOUND);
      }
      locked.push(document);
    }
    if (await documents.hasPayments(ids)) throw legacyBatchHasPayments();

    const toCancel = locked.filter((d) => d.status !== FinancialStatus.CANCELED);
    for (const document of toCancel) document.cancel();
    for (const document of toCancel) await documents.update(document);

    // Fichas: só o que esta confirmação mudou e ninguém mexeu desde então.
    const changes = await this.deps.creditHistory.importChanges([...credits.keys()], legacyImportReason(req.batchId));
    const names = await this.deps.customers.namesOf([...changes.keys()]);
    const restored: CreditRestoreItem[] = [];
    const notRestored: CreditRestoreItem[] = [];
    for (const customerId of [...changes.keys()].sort()) {
      const change = changes.get(customerId)!;
      const current = credits.get(customerId)!;
      const item = { customerId, name: names.get(customerId) ?? "" };
      const unchanged =
        current.limitCents === change.toLimitCents &&
        current.profileCode === change.toProfile &&
        !(await this.deps.creditHistory.changedSince(change));
      if (!unchanged) {
        notRestored.push(item);
        continue;
      }
      await this.deps.creditService.applyChange({
        customerId,
        profileCode: change.fromProfile,
        limitCents: change.fromLimitCents,
        reason: LEGACY_REVERT_REASON,
        source: CreditChangeSource.LEGACY_IMPORT,
        userId: req.userId,
      });
      restored.push(item);
    }

    await batches.markReverted(req.batchId, req.userId);
    return { ...(await storedBatchDTO(this.deps, req.batchId)), creditRestore: { restored, notRestored } };
  }
}
