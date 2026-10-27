import { api } from '@/shared/services/api';
import type { IProfitFilters, IProfitReport } from '../types';

export async function getProfitReport(filters: IProfitFilters): Promise<IProfitReport> {
  const response = await api.get<{ data: IProfitReport }>('/reports/profit', {
    params: { from: filters.from, to: filters.to, view: filters.view, sellerId: filters.sellerId || undefined },
  });

  return response.data.data;
}

export interface ISellerOption {
  id: string;
  name: string;
}

export async function getSellerOptions(): Promise<ISellerOption[]> {
  const response = await api.get<{ data: ISellerOption[] }>('/users', { params: { limit: 100 } });

  return response.data.data.map(({ id, name }) => ({ id, name }));
}
