import type { CreditProfileCode } from "@credit/domain/CreditProfileCode";

/** Mudança de ficha que a confirmação de um lote gravou (`source = LEGACY_IMPORT`, motivo do lote). */
export interface LegacyImportCreditChange {
  id: string;
  customerId: string;
  createdAt: Date;
  fromProfile: CreditProfileCode;
  toProfile: CreditProfileCode;
  fromLimitCents: number;
  toLimitCents: number;
}

export interface LegacyCreditHistory {
  /** A mudança mais recente com este motivo e `source = LEGACY_IMPORT`, por cliente. */
  importChanges(customerIds: string[], reason: string): Promise<Map<string, LegacyImportCreditChange>>;
  /** Houve outra mudança de ficha deste cliente depois (ou junto) desta? */
  changedSince(change: LegacyImportCreditChange): Promise<boolean>;
}
