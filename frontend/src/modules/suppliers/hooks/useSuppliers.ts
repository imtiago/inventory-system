import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/shared/react-query/keys';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';
import { getSupplierById, getSuppliers, searchSuppliers } from '../services/supplierService';

export function useSuppliers(page: number, search = '') {
  return useQuery({
    queryKey: [...queryKeys.suppliers, 'list', page, search],
    queryFn: () => getSuppliers(page, search.trim()),
    placeholderData: (previousData) => previousData,
  });
}

export function useSupplierSearch(search: string) {
  const debounced = useDebouncedValue(search.trim(), 300);

  return useQuery({
    queryKey: [...queryKeys.suppliers, 'search', debounced],
    queryFn: () => searchSuppliers(debounced),
    enabled: debounced.length >= 2,
    staleTime: 30_000,
    placeholderData: (previousData) => previousData,
  });
}

export function useSupplier(id: string) {
  return useQuery({
    queryKey: [...queryKeys.suppliers, 'detail', id],
    queryFn: () => getSupplierById(id),
    enabled: Boolean(id),
  });
}
