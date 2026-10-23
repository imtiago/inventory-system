import { useQuery } from '@tanstack/react-query';

import { parseApiErrorSync } from '@/shared/services/parseApiError';
import type { FinanceKind } from '../config';
import { getFinanceDocument } from '../services/financeService';
import { financeRoot } from './financeKeys';

export const financeDetailKey = (kind: FinanceKind, id: string | undefined) => [...financeRoot(kind), 'detail', id] as const;

export function useFinanceDocument(kind: FinanceKind, id: string | undefined) {
  return useQuery({
    queryKey: financeDetailKey(kind, id),
    queryFn: () => getFinanceDocument(kind, id as string),
    enabled: !!id,
    // Do not retry a missing document; keep up to 3 attempts for other errors.
    retry: (count: number, err: unknown) => parseApiErrorSync(err).status !== 404 && count < 3,
  });
}
