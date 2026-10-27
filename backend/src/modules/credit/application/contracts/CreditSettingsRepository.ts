import type { CreditRules } from "@credit/domain/creditRules";
import type { CreditSettingsReader } from "./CreditSettingsReader";

export interface UserRef {
  id: string;
  name: string;
}

export interface CreditSettingsRecord {
  crediarioEnabled: boolean;
  rules: CreditRules;
  enabledAt: Date | null;
  enabledBy: UserRef | null;
  updatedAt: Date;
  updatedBy: UserRef | null;
}

export interface CreditSettingsWrite {
  crediarioEnabled: boolean;
  rules: CreditRules;
  enabledAt: Date | null;
  enabledById: string | null;
  updatedById: string | null;
}

export interface CreditSettingsRepository {
  /** Trava a linha das configurações (FOR UPDATE). Exige transação. Não se combina com outras travas. */
  lock(): Promise<void>;
  read(): Promise<CreditSettingsRecord>;
  save(input: CreditSettingsWrite): Promise<void>;
}

export type CreditSettingsStore = CreditSettingsRepository & CreditSettingsReader;
