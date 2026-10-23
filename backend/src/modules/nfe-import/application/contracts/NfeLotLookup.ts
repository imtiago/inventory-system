/** Números de lote já existentes numa variante (para renomear a entrega da nota sem conflito). */
export interface NfeLotLookup {
  /** Quais dos `batchNumbers` já existem como lote da variante. */
  findExistingBatchNumbers(productVariantId: string, batchNumbers: string[]): Promise<string[]>;
}
