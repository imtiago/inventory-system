export interface ICustomer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
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
