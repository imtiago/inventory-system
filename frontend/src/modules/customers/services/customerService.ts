import { api } from '@/shared/services/api';
import type { CustomerListResponse, ICreateCustomerDTO, ICustomer } from '../types';

export async function getCustomers(page = 1): Promise<CustomerListResponse> {
  const response = await api.get('/customers', {
    params: {
      page,
      limit: 10,
    },
  });

  return response.data;
}

export async function createCustomer(data: ICreateCustomerDTO) {
  const response = await api.post('/customers', data);

  return response.data.data;
}

export const updateCustomer = async (id: string, input: any) => {
  const { data } = await api.put(`/customers/${id}`, input);
  // return response.data.data;
  return data;
};

export async function getCustomerById(id: string): Promise<ICustomer> {
  const response = await api.get(`/customers/${id}`);

  return response.data;
}

export const deleteProduct = async (id: string) => {
  await api.delete(`/customers/${id}`);
};
