import { api } from '@/shared/services/api';
import type { CustomerListResponse, ICreateCustomerDTO, ICustomer, UpdateCustomerInput } from '../types';

const PAGE_SIZE = 10;
const SEARCH_PAGE_SIZE = 20;

export async function getCustomers(page = 1, search = ''): Promise<CustomerListResponse> {
  const response = await api.get('/customers', {
    params: { page, limit: PAGE_SIZE, ...(search ? { search } : {}) },
  });

  return response.data;
}

export async function searchCustomers(search: string): Promise<CustomerListResponse> {
  const response = await api.get('/customers', {
    params: {
      page: 1,
      limit: SEARCH_PAGE_SIZE,
      search,
    },
  });

  return response.data;
}

export async function createCustomer(data: ICreateCustomerDTO) {
  const response = await api.post('/customers', data);

  return response.data.data;
}

export async function updateCustomer(id: string, input: UpdateCustomerInput): Promise<ICustomer> {
  const response = await api.patch<{ data: ICustomer }>(`/customers/${id}`, input);

  return response.data.data;
}

export async function getCustomerById(id: string): Promise<ICustomer> {
  const response = await api.get<{ data: ICustomer }>(`/customers/${id}`);

  return response.data.data;
}
