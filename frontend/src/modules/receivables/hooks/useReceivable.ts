import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/shared/react-query/keys';
import { parseApiErrorSync } from '@/shared/services/parseApiError';
import { getReceivable } from '../services/receivableService';

export const receivableDetailKey = (id: string | undefined) => [...queryKeys.receivables, 'detail', id] as const;

export function useReceivable(id: string | undefined) {
  return useQuery({
    queryKey: receivableDetailKey(id),
    queryFn: () => getReceivable(id as string),
    enabled: !!id,
    // Do not retry a missing document; keep up to 3 attempts for other errors.
    retry: (count: number, err: unknown) => parseApiErrorSync(err).status !== 404 && count < 3,
  });
}
