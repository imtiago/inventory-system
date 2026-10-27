import type { CreditProfileCode, CreditProfileParams } from "@credit/domain/CreditProfileCode";

/** Perfis de crédito na ordem (`position`). `byCode` de perfil inexistente é bug (as 4 linhas vêm da migration). */
export interface CreditProfileReader {
  list(): Promise<CreditProfileParams[]>;
  byCode(code: CreditProfileCode): Promise<CreditProfileParams>;
}

export interface CreditProfileRepository extends CreditProfileReader {
  update(code: CreditProfileCode, input: { initialLimitCents: number; minDownPaymentBps: number; maxInstallments: number }): Promise<void>;
}
