import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import type { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { businessTodayAsUtcDate, todayInBusinessTz } from "@shared/domain/businessDate";
import { CreditProfileCode } from "@credit/domain/CreditProfileCode";
import { CreditChangeSource } from "@credit/domain/customerCredit";
import type { CustomerCreditRepository } from "@credit/application/contracts/CustomerCreditRepository";
import type { CreditProfileReader } from "@credit/application/contracts/CreditProfileReader";
import type { CreditExposureReader } from "@credit/application/contracts/CreditExposureReader";
import type { CustomerCreditService } from "@credit/application/services/CustomerCreditService";
import type { CreateCustomerUseCase } from "@customer/application/useCases/commands/CreateCustomerUseCase";
import type { CreateFinancialDocumentUseCase } from "@finance/application/useCases/commands/CreateFinancialDocumentUseCase";
import { FinancialOriginType } from "@finance/domain/enums/FinancialOriginType";
import { FinancialPartyType } from "@finance/domain/enums/FinancialPartyType";
import { FinancialType } from "@finance/domain/enums/FinancialType";
import { hasUnresolvedDuplicate, type ReviewedRow } from "../../domain/legacyBatchReview";
import {
  legacyBatchEmpty,
  legacyBatchHasErrors,
  legacyBatchNotDraft,
  legacyBatchNotFound,
  legacyLinkedCustomerMissing,
  legacyUnresolvedDuplicates,
  legacyUnresolvedSimilarNames,
} from "../../domain/legacyErrors";
import type { LegacyLimitRule } from "../contracts/LegacyImportBatchRepository";
import type { LegacyBatchDTO } from "../dto/LegacyBatchDTO";
import { storedBatchDTO, type LegacyBatchDeps } from "./LegacyBatchUseCases";

export interface ConfirmLegacyBatchRequest {
  batchId: string;
  limitRule?: LegacyLimitRule;
  userId: string | null;
}

export interface ConfirmLegacyBatchDeps extends LegacyBatchDeps {
  customerCredits: Pick<CustomerCreditRepository, "lockMany">;
  creditService: Pick<CustomerCreditService, "applyChange">;
  profiles: Pick<CreditProfileReader, "byCode">;
  exposure: CreditExposureReader;
  createCustomer: Pick<CreateCustomerUseCase, "execute">;
  createDocument: Pick<CreateFinancialDocumentUseCase, "execute">;
}

/** Cliente de destino de um grupo de linhas: existente (vinculado) ou a criar a partir da linha-raiz. */
interface CustomerGroup {
  existingId: string | null;
  root: ReviewedRow;
  rows: ReviewedRow[];
}

/**
 * Confirma o lote numa transação só (a rota é idempotente). Travas: lote (FOR UPDATE) → fichas dos clientes
 * vinculados (`lockMany`, ORDER BY id) → revisão do lote (grava linhas) → cria clientes novos (código normal) → uma dívida LEGACY por linha →
 * perfil/limite por cliente (`applyChange`, fonte LEGACY_IMPORT) → lote CONFIRMED.
 *
 * Perfil: o da primeira linha (por número) do cliente que informa um; cliente novo sem perfil fica Novo;
 * cliente existente sem perfil mantém o seu. Limite:
 * - `MAX_OF_PROFILE_AND_BALANCE`: maior entre o limite atual (só cliente existente), o limite inicial do perfil
 *   aplicado (se algum) e o saldo em aberto total do cliente depois da importação — não nasce "estourado";
 * - `PROFILE_ONLY`: limite inicial do perfil aplicado; sem perfil aplicado, o limite não muda.
 */
export class ConfirmLegacyBatchUseCase extends TransactionalUseCase<ConfirmLegacyBatchRequest, LegacyBatchDTO> {
  constructor(private readonly deps: ConfirmLegacyBatchDeps, tm: TransactionManager) {
    super(tm);
  }

  protected async handle(req: ConfirmLegacyBatchRequest): Promise<LegacyBatchDTO> {
    const { batches, reviewer } = this.deps;
    const limitRule: LegacyLimitRule = req.limitRule ?? "MAX_OF_PROFILE_AND_BALANCE";

    const batch = await batches.lockById(req.batchId);
    if (!batch) throw legacyBatchNotFound();
    if (batch.status !== "DRAFT") throw legacyBatchNotDraft();

    // Fichas dos clientes vinculados travadas antes de qualquer escrita (ORDER BY id). Cliente apagado
    // depois do vínculo → 404 com as linhas (antes de a revisão regravar o vínculo).
    const stored = (await batches.rows(req.batchId)).filter((r) => r.status !== "IGNORED");
    const linkedLines = new Map<string, number[]>();
    for (const r of stored) {
      if (r.customerAction.kind !== "LINK") continue;
      const lines = linkedLines.get(r.customerAction.customerId) ?? [];
      lines.push(r.line);
      linkedLines.set(r.customerAction.customerId, lines);
    }
    const locked = new Map((await this.deps.customerCredits.lockMany([...linkedLines.keys()])).map((c) => [c.customerId, c]));
    const missingLines = [...linkedLines].filter(([id]) => !locked.has(id)).flatMap(([, lines]) => lines);
    if (missingLines.length > 0) throw legacyLinkedCustomerMissing(missingLines.sort((a, b) => a - b));

    // Revisão sob a trava: vale o estado de agora (clientes cadastrados depois da última revisão contam).
    const reviewed = await reviewer.reviewAndSave(req.batchId);
    const active = reviewed.rows.filter((r) => r.status !== "IGNORED");
    if (active.length === 0) throw legacyBatchEmpty();
    const withErrors = active.filter((r) => r.status === "ERROR");
    if (withErrors.length > 0) throw legacyBatchHasErrors(withErrors.map((r) => r.line));
    const undecided = active.filter((r) => r.issues.some((i) => i.code === "SIMILAR_CUSTOMER" || i.code === "SIMILAR_ROW"));
    if (undecided.length > 0) throw legacyUnresolvedSimilarNames(undecided.map((r) => r.line));
    const duplicates = active.filter(hasUnresolvedDuplicate);
    if (duplicates.length > 0) throw legacyUnresolvedDuplicates(duplicates.map((r) => r.line));

    const groups = this.groupByCustomer(active);

    for (const group of groups.values()) {
      if (group.existingId && !locked.has(group.existingId)) {
        // A revisão só cria vínculo para linha nova; aqui todo vínculo já veio travado acima.
        throw legacyLinkedCustomerMissing(group.rows.map((r) => r.line));
      }
    }

    // Clientes novos, na ordem das linhas.
    const customerOf = new Map<CustomerGroup, string>();
    for (const group of groups.values()) {
      if (group.existingId) {
        customerOf.set(group, group.existingId);
        continue;
      }
      const created = await this.deps.createCustomer.execute({ name: group.root.data.name, phone: group.root.data.phone });
      customerOf.set(group, created.id);
    }

    // Uma dívida por linha (originId = id da linha).
    const importDate = businessTodayAsUtcDate();
    for (const group of groups.values()) {
      const customerId = customerOf.get(group)!;
      for (const row of group.rows) {
        const parcels = row.data.dueDates
          ? row.data.dueDates.map((d) => ({ amountCents: d.amountCents, dueDate: new Date(`${d.date}T00:00:00.000Z`) }))
          : [{ amountCents: row.data.openCents, dueDate: importDate, dueDateUnknown: true }];
        const document = await this.deps.createDocument.execute({
          type: FinancialType.RECEIVABLE,
          originType: FinancialOriginType.LEGACY,
          originId: row.id,
          partyType: FinancialPartyType.CUSTOMER,
          partyId: customerId,
          noLateFees: true,
          parcels,
        });
        await batches.markRowImported(row.id, customerId, document.id);
      }
    }

    // Perfil e limite por cliente (depois das dívidas: o saldo já as inclui).
    const today = todayInBusinessTz();
    const reason = `Migração do caderninho (lote ${req.batchId.slice(0, 8)})`;
    const initialLimits = new Map<CreditProfileCode, number>();
    const initialLimit = async (code: CreditProfileCode) => {
      if (!initialLimits.has(code)) initialLimits.set(code, (await this.deps.profiles.byCode(code)).initialLimitCents);
      return initialLimits.get(code)!;
    };
    for (const group of groups.values()) {
      const customerId = customerOf.get(group)!;
      const isNew = group.existingId === null;
      const rowProfile = group.rows.find((r) => r.data.profileCode !== null)?.data.profileCode ?? null;
      const profile = rowProfile ?? (isNew ? CreditProfileCode.NEW : null);
      const profileLimit = profile ? await initialLimit(profile) : null;

      let limitCents: number | undefined;
      if (limitRule === "PROFILE_ONLY") {
        limitCents = profileLimit ?? undefined;
      } else {
        const { openBalanceCents } = await this.deps.exposure.forCustomer(customerId, today);
        const current = isNew ? 0 : locked.get(customerId)!.limitCents;
        limitCents = Math.max(current, profileLimit ?? 0, openBalanceCents);
      }
      await this.deps.creditService.applyChange({
        customerId,
        ...(profile ? { profileCode: profile } : {}),
        ...(limitCents !== undefined ? { limitCents } : {}),
        reason,
        source: CreditChangeSource.LEGACY_IMPORT,
        userId: req.userId,
      });
    }

    await batches.markConfirmed(req.batchId, { userId: req.userId, limitRule });
    return storedBatchDTO(this.deps, req.batchId);
  }

  /** Agrupa as linhas pelo cliente final: LINK por cliente, NEW pela própria linha, SAME_AS_ROW pela raiz. */
  private groupByCustomer(rows: ReviewedRow[]): Map<string, CustomerGroup> {
    const byId = new Map(rows.map((r) => [r.id, r]));
    const groups = new Map<string, CustomerGroup>();
    for (const row of [...rows].sort((a, b) => a.line - b.line)) {
      const action = row.customerAction;
      // A revisão já resolveu SAME_AS_ROW para a raiz (não ignorada, sem ciclo).
      const root = action.kind === "SAME_AS_ROW" ? byId.get(action.rowId) ?? row : row;
      const rootAction = root.customerAction;
      const key = rootAction.kind === "LINK" ? `c:${rootAction.customerId}` : `r:${root.id}`;
      let group = groups.get(key);
      if (!group) {
        group = { existingId: rootAction.kind === "LINK" ? rootAction.customerId : null, root, rows: [] };
        groups.set(key, group);
      }
      group.rows.push(row);
    }
    return groups;
  }
}
