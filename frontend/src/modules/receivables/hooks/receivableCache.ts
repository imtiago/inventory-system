import type { QueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/shared/react-query/keys';
import type { IReceivableDetail } from '../types';
import { receivableDetailKey } from './useReceivable';

/** Sets the detail from the response, then refreshes receivable lists and the origin sale detail. */
export async function applyReceivableUpdate(queryClient: QueryClient, detail: IReceivableDetail) {
  queryClient.setQueryData(receivableDetailKey(detail.id), detail);

  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.receivables, predicate: (q) => q.queryKey[1] !== 'detail' }),
    detail.originType === 'SALE' ? queryClient.invalidateQueries({ queryKey: [...queryKeys.sales, 'detail', detail.originId] }) : Promise.resolve(),
  ]);
}

/** After any failed write, re-read the detail so the user sees whether the change actually landed. */
export function refreshReceivable(queryClient: QueryClient, id: string) {
  return queryClient.invalidateQueries({ queryKey: receivableDetailKey(id) });
}
