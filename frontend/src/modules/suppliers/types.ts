import type { Paginated } from '@/shared/types/pagination';

export interface ISupplier {
  id: string;
  name: string;
  /** Digits only (11 = CPF, 14 = CNPJ). */
  document: string;
  documentType: 'CPF' | 'CNPJ';
  email: string | null;
  phone: string | null;
  createdAt: string;
}

export type SupplierListResponse = Paginated<ISupplier>;

export interface ICreateSupplierDTO {
  name: string;
  document: string;
  email?: string;
  phone?: string;
}

/** PATCH body: only the changed fields; email/phone null clear the value. */
export interface UpdateSupplierInput {
  name?: string;
  document?: string;
  email?: string | null;
  phone?: string | null;
}
