/** Pré-requisitos para ligar o crediário (spec §10). */
export interface CreditActivationChecks {
  /** Dados da loja (nome, CNPJ, endereço, telefone) preenchidos — o carnê precisa deles. */
  storeDataComplete(): Promise<boolean>;
  /** Usuários ativos com a marca "Pode aprovar crédito". */
  activeApproverCount(): Promise<number>;
}
