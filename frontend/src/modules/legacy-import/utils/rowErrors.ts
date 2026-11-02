import type { ApiError } from '@/shared/services/parseApiError';

import type { LegacyRow } from '../types';

/**
 * Cliente vinculado que sumiu (apagado depois do vínculo): o servidor responde 404 CUSTOMER_NOT_FOUND
 * ou, ao regravar a linha, 409 RESOURCE_IN_USE (chave estrangeira). A saída é trocar para "criar novo".
 */
export function isMissingLinkedCustomer(row: LegacyRow, error: ApiError): boolean {
  return row.customerAction.kind === 'LINK' && (error.code === 'CUSTOMER_NOT_FOUND' || error.code === 'RESOURCE_IN_USE');
}
