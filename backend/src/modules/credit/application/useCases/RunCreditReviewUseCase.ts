import { fromCents } from "@shared/domain/money";
import type { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { CreditProfileCode, nextProfile, previousProfile } from "@credit/domain/CreditProfileCode";
import { CreditChangeSource, CreditStatus, type CustomerCredit } from "@credit/domain/customerCredit";
import { reviewDecision, scoreCredit, type CreditReviewAction } from "@credit/domain/creditScore";
import type { CreditRules } from "@credit/domain/creditRules";
import type { CreditHistoryReader } from "@credit/application/contracts/CreditHistoryReader";
import type { CreditProfileReader } from "@credit/application/contracts/CreditProfileReader";
import type { CreditSettingsReader } from "@credit/application/contracts/CreditSettingsReader";
import type { CreditReviewCandidate, CreditReviewCandidates } from "@credit/application/contracts/CreditReviewCandidates";
import type { CustomerCreditRepository } from "@credit/application/contracts/CustomerCreditRepository";
import type { CustomerCreditService } from "@credit/application/services/CustomerCreditService";

const HISTORY_MONTHS = 12;
const BATCH = 100;

/** Uma mudança proposta (ou aplicada) pela revisão. Limites em reais. */
export interface CreditReviewItem {
  customerId: string;
  customerName: string;
  fromProfile: CreditProfileCode;
  toProfile: CreditProfileCode;
  fromLimit: number;
  toLimit: number;
  fromStatus: CreditStatus;
  toStatus: CreditStatus;
  action: Exclude<CreditReviewAction, "NONE">;
  reason: string;
  score: number;
}

interface Planned {
  item: CreditReviewItem;
  toProfile: CreditProfileCode;
  toLimitCents: number;
  toStatus: CreditStatus;
}

/**
 * Revisão periódica do limite (spec §5). `preview` não grava; `apply` recalcula sob a trava da ficha
 * (clientes em lotes ORDER BY id) e grava via `CustomerCreditService.applyChange` (`AUTO_REVIEW`).
 * UP → próximo perfil, limite = max(atual, inicial do novo); DOWN → anterior, limite = min(atual, inicial do novo);
 * SUSPEND → só a situação. Nunca mexe em dívida existente. BLOCKED/SUSPENDED não entram; quem já foi
 * revisado automaticamente hoje também não (idempotente no dia).
 */
export class RunCreditReviewUseCase {
  constructor(
    private readonly candidates: CreditReviewCandidates,
    private readonly customers: CustomerCreditRepository,
    private readonly profiles: CreditProfileReader,
    private readonly settings: CreditSettingsReader,
    private readonly history: CreditHistoryReader,
    private readonly credit: CustomerCreditService,
    private readonly transactionManager: TransactionManager,
  ) {}

  async preview(today: string, customerIds?: string[]): Promise<CreditReviewItem[]> {
    const { rules } = await this.settings.get();
    const initial = await this.initialLimits();
    const out: CreditReviewItem[] = [];
    let afterId: string | undefined;
    for (;;) {
      const batch = await this.candidates.list({ today, customerIds, afterId, limit: BATCH });
      if (batch.length === 0) return out;
      afterId = batch[batch.length - 1].customerId;
      out.push(...(await this.plan(batch, today, rules, initial)).map((p) => p.item));
      if (batch.length < BATCH) return out;
    }
  }

  async apply(input: { today: string; customerIds?: string[]; userId: string | null }): Promise<CreditReviewItem[]> {
    const { rules } = await this.settings.get();
    const initial = await this.initialLimits();
    const ids = input.customerIds ? [...new Set(input.customerIds)].sort() : undefined;
    const applied: CreditReviewItem[] = [];
    let afterId: string | undefined;
    for (;;) {
      // Escolhe o lote sem trava; recalcula e grava dentro da transação, com as fichas travadas.
      const batch = await this.candidates.list({ today: input.today, customerIds: ids, afterId, limit: BATCH });
      if (batch.length === 0) return applied;
      afterId = batch[batch.length - 1].customerId;
      const done = await this.transactionManager.execute(async () => {
        const locked = await this.customers.lockMany(batch.map((c) => c.customerId));
        const names = new Map(batch.map((c) => [c.customerId, c.customerName]));
        const fresh: CreditReviewCandidate[] = locked
          .filter((c) => c.status === CreditStatus.ACTIVE)
          .map((c) => ({ ...c, customerName: names.get(c.customerId) ?? "" }));
        // Quem foi revisado hoje entre a leitura e a trava sai (outra execução concorrente).
        const stillEligible = new Set(
          (await this.candidates.list({ today: input.today, customerIds: fresh.map((c) => c.customerId), limit: BATCH })).map((c) => c.customerId),
        );
        const plans = await this.plan(
          fresh.filter((c) => stillEligible.has(c.customerId)),
          input.today,
          rules,
          initial,
        );
        for (const p of plans) {
          await this.credit.applyChange({
            customerId: p.item.customerId,
            profileCode: p.toProfile,
            limitCents: p.toLimitCents,
            status: p.toStatus,
            reason: p.item.reason,
            source: CreditChangeSource.AUTO_REVIEW,
            userId: input.userId,
          });
        }
        return plans.map((p) => p.item);
      });
      applied.push(...done);
      if (batch.length < BATCH) return applied;
    }
  }

  private async initialLimits(): Promise<Map<CreditProfileCode, number>> {
    return new Map((await this.profiles.list()).map((p) => [p.code, p.initialLimitCents]));
  }

  private async plan(
    batch: CreditReviewCandidate[],
    today: string,
    rules: CreditRules,
    initial: Map<CreditProfileCode, number>,
  ): Promise<Planned[]> {
    if (batch.length === 0) return [];
    const histories = await this.history.forCustomers(
      batch.map((c) => c.customerId),
      today,
      HISTORY_MONTHS,
    );
    const out: Planned[] = [];
    for (const c of batch) {
      const h = histories.get(c.customerId);
      if (!h) continue;
      const score = scoreCredit(h, rules.review.weights);
      const decision = reviewDecision({ profile: c.profileCode, score, history: h, rules: rules.review });
      if (decision.action === "NONE") continue;
      const planned = this.target(c, decision.action, initial);
      if (!planned) continue;
      out.push({
        ...planned,
        item: {
          customerId: c.customerId,
          customerName: c.customerName,
          fromProfile: c.profileCode,
          toProfile: planned.toProfile,
          fromLimit: fromCents(c.limitCents),
          toLimit: fromCents(planned.toLimitCents),
          fromStatus: c.status,
          toStatus: planned.toStatus,
          action: decision.action,
          reason: decision.reason,
          score,
        },
      });
    }
    return out;
  }

  private target(
    c: CustomerCredit,
    action: Exclude<CreditReviewAction, "NONE">,
    initial: Map<CreditProfileCode, number>,
  ): { toProfile: CreditProfileCode; toLimitCents: number; toStatus: CreditStatus } | null {
    if (action === "SUSPEND") return { toProfile: c.profileCode, toLimitCents: c.limitCents, toStatus: CreditStatus.SUSPENDED };
    const to = action === "UP" ? nextProfile(c.profileCode) : previousProfile(c.profileCode);
    if (to === null) return null;
    const base = initial.get(to) ?? c.limitCents;
    const toLimitCents = action === "UP" ? Math.max(c.limitCents, base) : Math.min(c.limitCents, base);
    return { toProfile: to, toLimitCents, toStatus: c.status };
  }
}
