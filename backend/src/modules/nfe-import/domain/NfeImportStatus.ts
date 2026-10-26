export const NFE_IMPORT_STATUSES = ["DRAFT", "CONFIRMED", "REVERTED"] as const;

/**
 * DRAFT: rascunho em revisão; CONFIRMED: virou pedido de compra (`purchaseId`); REVERTED: importação
 * desfeita (estoque estornado, contas a pagar e pedido cancelados). Reenviar a chave de uma importação
 * REVERTED reabre a mesma linha como DRAFT.
 */
export type NfeImportStatus = (typeof NFE_IMPORT_STATUSES)[number];
