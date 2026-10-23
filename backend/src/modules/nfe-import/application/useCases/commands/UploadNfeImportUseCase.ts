import { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { NfeDocument } from "@nfe-import/domain/NfeDocument";
import { nfeAlreadyImported, unsupportedFileType } from "@nfe-import/domain/errors/nfeImportErrors";
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
 * - chave confirmada → 409 NFE_ALREADY_IMPORTED (details: purchaseId, importId);
 * - chave com rascunho → substitui o conteúdo (200); senão cria (201).
 * Dois envios simultâneos de uma chave nova: o segundo INSERT falha na unicidade
 * (sua transação aborta); repetimos uma vez numa transação nova, que agora encontra
 * o rascunho do primeiro e segue o caminho de substituição (ou 409 se já confirmado).
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
      saved = await this.save(document, userId);
    }
    return { created: saved.created, nfeImport: await this.getNfeImport.execute(saved.id) };
  }

  private save(document: NfeDocument, userId: string | null) {
    return this.transactionManager.execute(async () => {
      const existing = await this.repo.lockByAccessKey(document.accessKey);
      if (existing && existing.status !== "DRAFT") {
        throw nfeAlreadyImported({ purchaseId: existing.purchaseId, importId: existing.id });
      }
      if (existing) {
        await this.repo.replaceDraftContent(existing.id, document);
        return { id: existing.id, created: false };
      }
      return { id: await this.repo.createDraft(document, userId), created: true };
    });
  }
}
