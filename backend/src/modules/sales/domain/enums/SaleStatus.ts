export enum SaleStatus {
  /**
   * Mantido por compatibilidade: nenhum fluxo cria venda PENDING (o domínio nasce COMPLETED),
   * mas o filtro da API, o rótulo do CSV e o front ainda o conhecem. Remover exige migration
   * do enum e mudança no front (decisão adiada; ver docs/HISTORICO.md).
   */
  PENDING = "PENDING",
  COMPLETED = "COMPLETED",
  CANCELED = "CANCELED",
}
