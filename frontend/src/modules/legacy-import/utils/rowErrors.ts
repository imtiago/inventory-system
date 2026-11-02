import type { ApiError } from '@/shared/services/parseApiError';

import type { LegacyRow } from '../types';

/**
 * Cliente vinculado que sumiu (apagado entre a revisão e a ação): o servidor responde 404 CUSTOMER_NOT_FOUND.
 * A revisão já marca a linha com LINKED_CUSTOMER_MISSING; a saída é trocar para "criar novo".
 */
export function isMissingLinkedCustomer(row: LegacyRow, error: ApiError): boolean {
  return row.customerAction.kind === 'LINK' && error.code === 'CUSTOMER_NOT_FOUND';
}
