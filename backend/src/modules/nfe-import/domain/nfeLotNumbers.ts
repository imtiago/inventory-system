/** Limite do número do lote (o mesmo do recebimento manual). */
export const MAX_BATCH_NUMBER_LENGTH = 60;

/**
 * Candidatos a número do lote de uma entrega da nota, em ordem de preferência: o próprio nLote;
 * "<nLote>-<código do pedido>"; "<nLote>-<código do pedido>-2", "-3"... Cada um cortado para
 * caber nos 60 caracteres (corta o nLote, nunca o sufixo).
 */
export function batchNumberCandidates(batchNumber: string, purchaseCode: string, count: number): string[] {
  return Array.from({ length: count }, (_, k) => (k === 0 ? batchNumber : renamedBatchNumber(batchNumber, purchaseCode, k)));
}

/**
 * Número de lote de uma entrega da nota. O fornecedor repete o nLote entre entregas, mas um lote
 * só soma no mesmo item do pedido: se o número já existe na variante, a entrega vai para o primeiro
 * candidato livre (ver `batchNumberCandidates`). Sempre devolve um número: a nota nunca perde o
 * lote (e com ele a validade). `taken`: números de lote já existentes na variante.
 */
export function deliveryBatchNumber(batchNumber: string, purchaseCode: string, taken: ReadonlySet<string>): string {
  for (let k = 0; ; k++) {
    const candidate = k === 0 ? batchNumber : renamedBatchNumber(batchNumber, purchaseCode, k);
    if (!taken.has(candidate)) return candidate;
  }
}

/** k = 1: "<nLote>-<pedido>"; k ≥ 2: "<nLote>-<pedido>-<k>", com no máximo 60 caracteres. */
export function renamedBatchNumber(batchNumber: string, purchaseCode: string, sequence = 1): string {
  const suffix = sequence <= 1 ? `-${purchaseCode}` : `-${purchaseCode}-${sequence}`;
  return `${batchNumber.slice(0, Math.max(0, MAX_BATCH_NUMBER_LENGTH - suffix.length))}${suffix}`;
}
