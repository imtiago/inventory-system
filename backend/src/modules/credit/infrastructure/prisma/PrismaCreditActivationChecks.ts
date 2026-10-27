import { getDb } from "@shared/infrastructure/prisma/transactionContext";
import type { CreditActivationChecks } from "@credit/application/contracts/CreditActivationChecks";

/**
 * Pré-requisitos da ativação. Aprovador = usuário ativo com a marca "Pode aprovar crédito" (o ADMIN por
 * papel não conta, senão a regra seria sempre verdadeira: quem ativa já é ADMIN).
 * Dados da loja: `StoreSettings` só existe a partir da Task 13 — até lá a checagem falha fechada
 * (o crediário não pode ser ligado); a Task 13 troca `storeDataComplete` pela leitura real.
 */
export class PrismaCreditActivationChecks implements CreditActivationChecks {
  async storeDataComplete(): Promise<boolean> {
    return false;
  }

  async activeApproverCount(): Promise<number> {
    return getDb().user.count({ where: { active: true, canApproveCredit: true } });
  }
}
