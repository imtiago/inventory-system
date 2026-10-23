export interface ICustomer {
  id: string;
  name: string;
  code: string;
  email: string | null;
  phone: string | null;
  address: string | null;
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
}

/** PATCH body: only changed fields; null clears an optional field. */
export type UpdateCustomerInput = Partial<ICreateCustomerDTO>;
