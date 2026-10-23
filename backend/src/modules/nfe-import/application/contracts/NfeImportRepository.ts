import { NfeDocument } from "@nfe-import/domain/NfeDocument";
import { NfeImportStatus } from "@nfe-import/domain/NfeImportStatus";

export interface LockedNfeImport {
  id: string;
  status: NfeImportStatus;
  purchaseId: string | null;
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
  delete(id: string): Promise<void>;
}
