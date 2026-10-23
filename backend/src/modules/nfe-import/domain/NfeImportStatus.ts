export const NFE_IMPORT_STATUSES = ["DRAFT", "CONFIRMED"] as const;

/** DRAFT: rascunho em revisão; CONFIRMED: virou pedido de compra (`purchaseId`). */
export type NfeImportStatus = (typeof NFE_IMPORT_STATUSES)[number];
