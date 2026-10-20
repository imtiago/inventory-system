import { useQuery } from '@tanstack/react-query';

import { getSales } from '../services/saleService';

export function useSales(page: number) {
  return useQuery({
    queryKey: ['sales', page],
    queryFn: () => getSales(page),
    placeholderData: (previousData) => previousData,
  });
}
