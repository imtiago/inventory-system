/** Motivo da mudança de ficha gravada pela confirmação do lote (o desfazer procura por ele). */
export const legacyImportReason = (batchId: string) => `Migração do caderninho (lote ${batchId.slice(0, 8)})`;

/** Motivo da ficha restaurada ao desfazer o lote. */
export const LEGACY_REVERT_REASON = "Lote desfeito";
