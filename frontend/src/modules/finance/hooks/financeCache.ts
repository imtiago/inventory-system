import type { QueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/shared/react-query/keys';
import type { FinanceKind } from '../config';
import type { IFinanceDetail } from '../types';
import { financeRoot } from './financeKeys';
import { financeDetailKey } from './useFinanceDocument';

/** Sets the detail from the response, then refreshes the lists of this kind and the origin document (sale or purchase) detail. */
export async function applyFinanceUpdate(queryClient: QueryClient, kind: FinanceKind, detail: IFinanceDetail) {
  queryClient.setQueryData(financeDetailKey(kind, detail.id), detail);

  const originRoot = detail.originType === 'SALE' ? queryKeys.sales : detail.originType === 'PURCHASE' ? queryKeys.purchases : null;

  await Promise.all([
    queryClient.invalidateQueries({ queryKey: financeRoot(kind), predicate: (q) => q.queryKey[1] !== 'detail' }),
    originRoot ? queryClient.invalidateQueries({ queryKey: [...originRoot, 'detail', detail.originId] }) : Promise.resolve(),
  ]);
}

/** After any failed write, re-read the detail so the user sees whether the change actually landed. */
export function refreshFinanceDocument(queryClient: QueryClient, kind: FinanceKind, id: string) {
  return queryClient.invalidateQueries({ queryKey: financeDetailKey(kind, id) });
}
