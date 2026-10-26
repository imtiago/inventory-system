import { NfeDocument } from "@nfe-import/domain/NfeDocument";
import { NfeImportStatus } from "@nfe-import/domain/NfeImportStatus";

export interface LockedNfeImport {
  id: string;
  status: NfeImportStatus;
  purchaseId: string | null;
  /** Status do pedido gerado; null sem pedido (rascunho, ou pedido excluído). */
  purchaseStatus: string | null;
}

/**
 * Outra transação gravou a mesma chave de acesso antes (violação de unicidade).
 * A transação atual fica abortada: quem chama repete a operação numa nova transação.
 */
export class NfeImportAccessKeyTaken extends Error {
  constructor() {
    super("NfeImport.accessKey já existe.");
    this.name = "NfeImportAccessKeyTaken";
  }
}

/** Escrita de importações. Métodos `lock*` exigem transação ativa (SELECT ... FOR UPDATE). */
export interface NfeImportRepository {
  lockByAccessKey(accessKey: string): Promise<LockedNfeImport | null>;
  lockById(id: string): Promise<LockedNfeImport | null>;
  /** Lança `NfeImportAccessKeyTaken` se a chave já existir. */
  createDraft(document: NfeDocument, createdById: string | null): Promise<string>;
  replaceDraftContent(id: string, document: NfeDocument): Promise<void>;
  /** Confirmada cujo pedido foi cancelado/excluído → DRAFT com o conteúdo novo (mesmo id, sem pedido/confirmação). */
  resetToDraft(id: string, document: NfeDocument): Promise<void>;
  /** Documento lido (payload) da importação. */
  findDocument(id: string): Promise<NfeDocument | null>;
  /** Rascunho → CONFIRMED com o pedido gerado, quem confirmou e quando. */
  markConfirmed(input: { id: string; purchaseId: string; confirmedById: string }): Promise<void>;
  /** CONFIRMED → REVERTED (importação desfeita; o pedido fica ligado, cancelado). */
  markReverted(id: string): Promise<void>;
  delete(id: string): Promise<void>;
}
