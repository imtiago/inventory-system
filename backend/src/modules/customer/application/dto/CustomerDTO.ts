export interface ICustomerDTO {
  id: string;
  name: string;
  code: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  createdAt: Date;
}

export interface ICreateCustomerInput {
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
}

export interface IUpdateCustomerInput {
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
}
