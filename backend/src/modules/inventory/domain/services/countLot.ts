/**
 * Número do lote "aberto" da contagem: um por variante, caixa e validade.
 * Sem validade: CONT-<caixa>-<variante>; com validade: ...-<AAAAMMDD>.
 * Usado pelo fluxo ao vivo (RegisterScannedProduct) e pelo script merge-count-lots.
 */
export function countBatchNumber(boxCode: string, variantCode: string, expirationDate?: Date | null): string {
  const base = `CONT-${boxCode}-${variantCode}`;
  return expirationDate ? `${base}-${expirationDate.toISOString().slice(0, 10).replaceAll("-", "")}` : base;
}
