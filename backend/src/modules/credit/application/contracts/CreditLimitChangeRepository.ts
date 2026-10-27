import type { CreditProfileCode } from "@credit/domain/CreditProfileCode";
import type { CreditChangeSource, CreditStatus } from "@credit/domain/customerCredit";
import type { UserRef } from "./CreditSettingsRepository";

export interface CreditLimitChangeRecord {
  id: string;
  customerId: string;
  fromProfile: CreditProfileCode;
  toProfile: CreditProfileCode;
  fromLimitCents: number;
  toLimitCents: number;
  fromStatus: CreditStatus;
  toStatus: CreditStatus;
  reason: string;
  source: CreditChangeSource;
  changedBy: UserRef | null;
  createdAt: Date;
}

export type NewCreditLimitChange = Omit<CreditLimitChangeRecord, "id" | "changedBy" | "createdAt"> & {
  changedById: string | null;
};

export interface CreditLimitChangeRepository {
  record(change: NewCreditLimitChange): Promise<void>;
  /** Mais recente primeiro. */
  listForCustomer(customerId: string, limit: number): Promise<CreditLimitChangeRecord[]>;
}
