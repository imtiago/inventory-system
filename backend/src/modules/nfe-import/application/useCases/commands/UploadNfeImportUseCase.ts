import { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { NfeDocument } from "@nfe-import/domain/NfeDocument";
import { concurrentUpload, nfeAlreadyImported, unsupportedFileType } from "@nfe-import/domain/errors/nfeImportErrors";
import { NfeDocumentParser } from "../../contracts/NfeDocumentParser";
import { NfeImportAccessKeyTaken, NfeImportRepository } from "../../contracts/NfeImportRepository";
import { NfeImportDTO } from "../../dto/NfeImportDTO";
import { GetNfeImportUseCase } from "../queries/GetNfeImportUseCase";

export interface UploadNfeImportInput {
  file: Buffer;
  userId: string | null;
}

export interface UploadNfeImportResult {
  /** true → rascunho novo (201); false → rascunho existente substituído (200). */
  created: boolean;
  nfeImport: NfeImportDTO;
}

const PDF_SIGNATURE = Buffer.from("%PDF");

/**
 * Envio do XML: lê e valida a nota e grava o rascunho pela chave de acesso.
 * - chave confirmada com pedido ativo → 409 NFE_ALREADY_IMPORTED (details: purchaseId, importId);
 * - chave confirmada cujo pedido foi cancelado (ou excluído) → volta a rascunho com o conteúdo novo,
 *   mesmo id (200); os mapeamentos aprendidos ficam;
 * - chave com rascunho → substitui o conteúdo (200); senão cria (201).
 * Dois envios simultâneos de uma chave nova: o segundo INSERT falha na unicidade
 * (sua transação aborta); repetimos uma vez numa transação nova, que agora encontra
 * o rascunho do primeiro e segue o caminho de substituição (ou 409 se já confirmado).
 * Se a repetição também perder a corrida → 409 CONCURRENT_UPDATE.
 */
export class UploadNfeImportUseCase {
  constructor(
    private parser: NfeDocumentParser,
    private repo: NfeImportRepository,
    private transactionManager: TransactionManager,
    private getNfeImport: GetNfeImportUseCase,
  ) {}

  async execute({ file, userId }: UploadNfeImportInput): Promise<UploadNfeImportResult> {
    // Pelo conteúdo, não pela extensão: DANFE em PDF não é mais aceita.
    if (file.subarray(0, PDF_SIGNATURE.length).equals(PDF_SIGNATURE)) throw unsupportedFileType();
    const document = this.parser.parse(file);

    let saved: { id: string; created: boolean };
    try {
      saved = await this.save(document, userId);
    } catch (e) {
      if (!(e instanceof NfeImportAccessKeyTaken)) throw e;
      try {
        saved = await this.save(document, userId);
      } catch (retryError) {
        // Perdeu a corrida de novo (rascunho criado e apagado entre as tentativas): 409, não 500.
        if (retryError instanceof NfeImportAccessKeyTaken) throw concurrentUpload();
        throw retryError;
      }
    }
    return { created: saved.created, nfeImport: await this.getNfeImport.execute(saved.id) };
  }

  private save(document: NfeDocument, userId: string | null) {
    return this.transactionManager.execute(async () => {
      const existing = await this.repo.lockByAccessKey(document.accessKey);
      if (existing && existing.status !== "DRAFT") {
        if (existing.purchaseStatus !== null && existing.purchaseStatus !== "CANCELED") {
          throw nfeAlreadyImported({ purchaseId: existing.purchaseId, importId: existing.id });
        }
        await this.repo.resetToDraft(existing.id, document);
        return { id: existing.id, created: false };
      }
      if (existing) {
        await this.repo.replaceDraftContent(existing.id, document);
        return { id: existing.id, created: false };
      }
      return { id: await this.repo.createDraft(document, userId), created: true };
    });
  }
}
