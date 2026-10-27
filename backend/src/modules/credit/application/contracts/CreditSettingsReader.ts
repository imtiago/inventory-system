import type { CreditRules } from "@credit/domain/creditRules";

/** Leitura das configurações do crediário (linha única, sempre existe: criada pela migration). */
export interface CreditSettingsReader {
  get(): Promise<{ crediarioEnabled: boolean; rules: CreditRules }>;
}
