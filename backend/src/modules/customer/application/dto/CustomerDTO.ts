export interface CustomerDTO {
  id: string;
  code: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  document: string | null;
  createdAt: Date;
}

export interface ICreateCustomerInput {
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  document?: string | null;
}

/** Atualização parcial: só as chaves presentes são gravadas; `null` limpa o campo. */
export interface CustomerPatch {
  name?: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  document?: string | null;
}

export interface IUpdateCustomerInput extends CustomerPatch {
  id: string;
}
