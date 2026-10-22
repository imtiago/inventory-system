export interface TransactionManager {
  /**
   * Executa `work` de forma atômica. Chamadas aninhadas participam
   * da transação mais externa.
   */
  execute<T>(work: () => Promise<T>): Promise<T>;
}
