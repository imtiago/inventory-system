import { fromCents } from "@shared/domain/money";
import type { CreditProfileCode } from "@credit/domain/CreditProfileCode";
import type { CreditChangeSource, CreditStatus } from "@credit/domain/customerCredit";
import type { UserRef } from "@credit/application/contracts/CreditSettingsRepository";
import type { CreditLimitChangeRecord } from "@credit/application/contracts/CreditLimitChangeRepository";

export interface CreditLimitChangeDTO {
  id: string;
  fromProfile: CreditProfileCode;
  toProfile: CreditProfileCode;
  fromLimit: number;
  toLimit: number;
  fromStatus: CreditStatus;
  toStatus: CreditStatus;
  reason: string;
  source: CreditChangeSource;
  changedBy: UserRef | null;
  createdAt: Date;
}

export interface CustomerCreditDTO {
  profileCode: CreditProfileCode;
  profileName: string;
  limit: number;
  openBalance: number;
  /** Parte de `openBalance` que veio do caderninho (dívidas antigas, sem encargos). */
  legacyOpenBalance: number;
  available: number;
  status: CreditStatus;
  currentMaxOverdueDays: number;
  /** Mais recente primeiro. */
  history: CreditLimitChangeDTO[];
}

export function toCreditLimitChangeDTO(c: CreditLimitChangeRecord): CreditLimitChangeDTO {
  return {
    id: c.id,
    fromProfile: c.fromProfile,
    toProfile: c.toProfile,
    fromLimit: fromCents(c.fromLimitCents),
    toLimit: fromCents(c.toLimitCents),
    fromStatus: c.fromStatus,
    toStatus: c.toStatus,
    reason: c.reason,
    source: c.source,
    changedBy: c.changedBy,
    createdAt: c.createdAt,
  };
}
