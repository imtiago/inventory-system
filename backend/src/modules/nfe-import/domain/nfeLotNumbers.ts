/** Limite do número do lote (o mesmo do recebimento manual). */
export const MAX_BATCH_NUMBER_LENGTH = 60;

/**
 * Número do lote de uma entrega da nota. O fornecedor repete o nLote entre entregas, mas um lote
 * só soma no mesmo item do pedido: se o número já existe na variante, a entrega vai para
 * "<nLote>-<código do pedido>" (cortando o nLote para caber nos 60 caracteres, sem cortar o
 * sufixo); se esse também existe (reimportação), entra sem lote (undefined).
 * `taken`: números de lote já existentes na variante.
 */
export function deliveryBatchNumber(batchNumber: string, purchaseCode: string, taken: ReadonlySet<string>): string | undefined {
  if (!taken.has(batchNumber)) return batchNumber;
  const renamed = renamedBatchNumber(batchNumber, purchaseCode);
  return taken.has(renamed) ? undefined : renamed;
}

/** "<nLote>-<código do pedido>", com no máximo 60 caracteres (corta o nLote, nunca o sufixo). */
export function renamedBatchNumber(batchNumber: string, purchaseCode: string): string {
  const suffix = `-${purchaseCode}`;
  return `${batchNumber.slice(0, Math.max(0, MAX_BATCH_NUMBER_LENGTH - suffix.length))}${suffix}`;
}
