import { NfeDocument } from "@nfe-import/domain/NfeDocument";

/** Lê e valida o XML da NF-e (implementação: `NfeParser`). */
export interface NfeDocumentParser {
  parse(input: Buffer): NfeDocument;
}
