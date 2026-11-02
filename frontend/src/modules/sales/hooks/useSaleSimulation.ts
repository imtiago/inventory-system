import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/shared/react-query/keys';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';

import { simulateSale } from '../services/saleService';
import type { ISaleSimulationRequest } from '../types';

/**
 * Valores do fechamento por condição e as opções do crediário (POST /sales/simulate, não grava).
 * `request` null = carrinho/cliente ainda incompletos. Entrada e dia digitados passam por um
 * pequeno atraso para não simular a cada tecla; o resultado anterior fica na tela enquanto isso.
 */
export function useSaleSimulation(request: ISaleSimulationRequest | null) {
  const debounced = useDebouncedValue(request, 300);
  // Carrinho/cliente mudam o resultado na hora: só a entrada espera o atraso.
  const effective = request && debounced && sameCart(request, debounced) ? { ...request, downPayment: debounced.downPayment } : request;

  const query = useQuery({
    queryKey: queryKeys.saleSimulation(effective ?? {}),
    queryFn: () => simulateSale(effective as ISaleSimulationRequest),
    enabled: effective !== null,
    placeholderData: (previous) => previous,
    staleTime: 15_000,
  });

  const settled = effective !== null && request !== null && effective.downPayment === request.downPayment && !query.isFetching;

  return { ...query, data: effective ? query.data : undefined, settled };
}

function sameCart(a: ISaleSimulationRequest, b: ISaleSimulationRequest): boolean {
  return a.customerId === b.customerId && JSON.stringify(a.items) === JSON.stringify(b.items);
}
