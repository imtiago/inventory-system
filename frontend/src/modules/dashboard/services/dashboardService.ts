import { api } from '@/shared/services/api';
import type { IDashboard } from '../types';

export async function getDashboard(): Promise<IDashboard> {
  const response = await api.get<{ data: IDashboard }>('/dashboard');

  return response.data.data;
}
