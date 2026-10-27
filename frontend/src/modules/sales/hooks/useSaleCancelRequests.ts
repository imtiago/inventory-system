import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { useCan } from '@/shared/auth/useCan';
import { queryKeys } from '@/shared/react-query/keys';

import { getSaleCancelRequestCount, listSaleCancelRequests } from '../services/saleService';
import type { ISaleCancelRequest } from '../types';

export const CANCEL_REQUESTS_PAGE_SIZE = 20;

export function useSaleCancelRequests(page: number, status: ISaleCancelRequest['status']) {
  const params = { page, limit: CANCEL_REQUESTS_PAGE_SIZE, status };

  return useQuery({ queryKey: queryKeys.cancelRequestList(params), queryFn: () => listSaleCancelRequests(params), placeholderData: keepPreviousData });
}

/** Pendentes (menu). Só consulta quem tem `sales.cancel`; sem a permissão a rota responderia 403. */
export function useSaleCancelRequestCount() {
  const allowed = useCan('sales.cancel');

  return useQuery({ queryKey: queryKeys.cancelRequestCount, queryFn: getSaleCancelRequestCount, enabled: allowed, staleTime: 30_000 });
}
