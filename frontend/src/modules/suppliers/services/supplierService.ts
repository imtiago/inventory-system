import { api } from '@/shared/services/api';
import type { ICreateSupplierDTO, ISupplier, SupplierListResponse, UpdateSupplierInput } from '../types';

const PAGE_SIZE = 10;
const SEARCH_PAGE_SIZE = 20;

export async function getSuppliers(page = 1, search = ''): Promise<SupplierListResponse> {
  const response = await api.get('/suppliers', { params: { page, limit: PAGE_SIZE, ...(search ? { search } : {}) } });

  return response.data;
}

export async function searchSuppliers(search: string): Promise<SupplierListResponse> {
  const response = await api.get('/suppliers', { params: { page: 1, limit: SEARCH_PAGE_SIZE, search } });

  return response.data;
}

export async function createSupplier(data: ICreateSupplierDTO): Promise<ISupplier> {
  const response = await api.post<{ data: ISupplier }>('/suppliers', data);

  return response.data.data;
}

export async function updateSupplier(id: string, input: UpdateSupplierInput): Promise<ISupplier> {
  const response = await api.patch<{ data: ISupplier }>(`/suppliers/${id}`, input);

  return response.data.data;
}

export async function deleteSupplier(id: string): Promise<void> {
  await api.delete(`/suppliers/${id}`);
}
