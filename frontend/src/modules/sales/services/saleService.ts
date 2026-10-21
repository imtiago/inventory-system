import { api } from '@/shared/services/api';
import type { ICreateSaleDTO, ISalesResponse } from '../types';

const PAGE_SIZE = 10;

export async function getSales(page = 1): Promise<ISalesResponse> {
  const response = await api.get('/sales', {
    params: {
      page,
      limit: PAGE_SIZE,
    },
  });

  return response.data;
}

export async function createSale(data: ICreateSaleDTO) {
  const response = await api.post('/sales', data);

  return response.data.data;
}

// export const updateCustomer = async (id: string, input: any) => {
//   const { data } = await api.put(`/customers/${id}`, input);
//   // return response.data.data;
//   return data;
// };

// export async function getCustomerById(id: string): Promise<ICustomer> {
//   const response = await api.get(`/customers/${id}`);

//   return response.data;
// }

// export const deleteProduct = async (id: string) => {
//   await api.delete(`/customers/${id}`);
// };
