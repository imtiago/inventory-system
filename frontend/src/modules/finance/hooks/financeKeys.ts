import { queryKeys } from '@/shared/react-query/keys';
import type { FinanceKind } from '../config';

/** Distinct cache namespace per document kind. */
export const financeRoot = (kind: FinanceKind) => (kind === 'receivable' ? queryKeys.receivables : queryKeys.payables);
