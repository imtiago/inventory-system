import { getDb } from "@shared/infrastructure/prisma/transactionContext";
import type { CreditActivationChecks } from "@credit/application/contracts/CreditActivationChecks";

/**
 * Pré-requisitos da ativação. Aprovador = usuário ativo com a marca "Pode aprovar crédito" (o ADMIN por
 * papel não conta, senão a regra seria sempre verdadeira: quem ativa já é ADMIN).
 * Dados da loja: `StoreSettings` com nome, CNPJ, endereço e telefone preenchidos (o carnê precisa deles).
 */
export class PrismaCreditActivationChecks implements CreditActivationChecks {
  async storeDataComplete(): Promise<boolean> {
    const store = await getDb().storeSettings.findUnique({ where: { id: "default" } });
    return !!store && [store.name, store.cnpj, store.address, store.phone].every((v) => v.trim().length > 0);
  }

  async activeApproverCount(): Promise<number> {
    return getDb().user.count({ where: { active: true, canApproveCredit: true } });
  }
}
