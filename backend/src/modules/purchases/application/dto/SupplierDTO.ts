import { DocumentType } from "@shared/domain/document";

export interface SupplierDTO {
  id: string;
  name: string;
  document: string;
  documentType: DocumentType;
  email: string | null;
  phone: string | null;
  createdAt: Date;
}

export interface ICreateSupplierInput {
  name: string;
  document: string;
  email?: string | null;
  phone?: string | null;
}

/** Atualização parcial: só as chaves presentes são gravadas; `null` limpa e-mail/telefone. */
export interface SupplierPatch {
  name?: string;
  document?: string;
  email?: string | null;
  phone?: string | null;
}

export interface IUpdateSupplierInput extends SupplierPatch {
  id: string;
}
