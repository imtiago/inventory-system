import { toCents } from "@shared/domain/money";
import { getDb } from "@shared/infrastructure/prisma/transactionContext";
import type { CreditProfileCode } from "@credit/domain/CreditProfileCode";
import type { LegacyCreditHistory, LegacyImportCreditChange } from "../../application/contracts/LegacyCreditHistory";

export class PrismaLegacyCreditHistory implements LegacyCreditHistory {
  async importChanges(customerIds: string[], reason: string): Promise<Map<string, LegacyImportCreditChange>> {
    if (customerIds.length === 0) return new Map();
    const rows = await getDb().creditLimitChange.findMany({
      where: { customerId: { in: [...new Set(customerIds)] }, source: "LEGACY_IMPORT", reason },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    const out = new Map<string, LegacyImportCreditChange>();
    for (const r of rows) {
      if (out.has(r.customerId)) continue;
      out.set(r.customerId, {
        id: r.id,
        customerId: r.customerId,
        createdAt: r.createdAt,
        fromProfile: r.fromProfile as CreditProfileCode,
        toProfile: r.toProfile as CreditProfileCode,
        fromLimitCents: toCents(Number(r.fromLimit)),
        toLimitCents: toCents(Number(r.toLimit)),
      });
    }
    return out;
  }

  async changedSince(change: LegacyImportCreditChange): Promise<boolean> {
    const later = await getDb().creditLimitChange.count({
      where: { customerId: change.customerId, id: { not: change.id }, createdAt: { gte: change.createdAt } },
    });
    return later > 0;
  }
}
