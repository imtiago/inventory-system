export interface ICustomer {
  id: string;
  name: string;
  code: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  /** CPF/CNPJ, only digits/letters as stored (unmasked). */
  document: string | null;
  createdAt: string;
}
export interface CustomerListResponse {
  data: ICustomer[];

  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ICreateCustomerDTO {
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  /** CPF/CNPJ (unmasked); null/absent = not informed. */
  document?: string | null;
}

/** PATCH body: only changed fields; null clears an optional field. */
export type UpdateCustomerInput = Partial<ICreateCustomerDTO>;
