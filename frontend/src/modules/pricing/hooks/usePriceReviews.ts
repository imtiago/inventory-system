import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { useCan } from '@/shared/auth/useCan';
import { queryKeys } from '@/shared/react-query/keys';

import { getPriceReviewCount, listPriceReviews } from '../services/pricingService';

export const PRICE_REVIEWS_PAGE_SIZE = 20;

export function usePriceReviews(page: number) {
  const params = { page, limit: PRICE_REVIEWS_PAGE_SIZE };

  return useQuery({ queryKey: queryKeys.priceReviewList(params), queryFn: () => listPriceReviews(params), placeholderData: keepPreviousData });
}

/** Pendentes (menu). Só consulta quem tem `catalog.price`; sem a permissão a rota responderia 403. */
export function usePriceReviewCount() {
  const allowed = useCan('catalog.price');

  return useQuery({ queryKey: queryKeys.priceReviewCount, queryFn: getPriceReviewCount, enabled: allowed, staleTime: 30_000 });
}
