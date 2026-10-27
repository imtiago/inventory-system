import { queryKeys } from '@/shared/react-query/keys';
import { useCrudMutation } from '@/shared/react-query/useCrudMutation';
import { productQueryKeys } from '@/modules/products/config/queryKeys';

import { applyPriceReviews, applyVariantPrice, dismissPriceReview, setSupplierPrice } from '../services/pricingService';
import type { ApplyPriceSource } from '../types';

// Preço novo muda a lista de produtos/variantes, a composição, a lista de revisão (e o contador) e o cartão do dashboard.
const priceKeys = (variantId: string) => [queryKeys.products, productQueryKeys.variant(variantId), queryKeys.variantPricing(variantId), queryKeys.priceReviews, queryKeys.dashboard] as const;
// Aplicar em lote não diz quais variantes mudaram: invalida todas as composições e variantes abertas.
const REVIEW_KEYS = [queryKeys.products, ['variant'], ['pricing', 'variants'], queryKeys.priceReviews, queryKeys.dashboard] as const;

export function useApplyPrice(variantId: string) {
  return useCrudMutation({
    mutationFn: (source: ApplyPriceSource) => applyVariantPrice(variantId, source),
    invalidateKeys: priceKeys(variantId),
    successMessage: 'Preço de venda atualizado.',
    errorMessage: 'Não foi possível aplicar o preço.',
  });
}

export function useSetSupplierPrice(variantId: string) {
  return useCrudMutation({
    mutationFn: (price: number | null) => setSupplierPrice(variantId, price),
    invalidateKeys: [queryKeys.variantPricing(variantId)],
    successMessage: 'Preço da revista salvo.',
    errorMessage: 'Não foi possível salvar o preço da revista.',
  });
}

export function useApplyPriceReviews() {
  return useCrudMutation({
    mutationFn: (ids: string[]) => applyPriceReviews(ids),
    invalidateKeys: REVIEW_KEYS,
    errorMessage: 'Não foi possível aplicar os preços.',
  });
}

export function useDismissPriceReview() {
  return useCrudMutation({
    mutationFn: (id: string) => dismissPriceReview(id),
    invalidateKeys: [queryKeys.priceReviews, queryKeys.dashboard],
    successMessage: 'Preço mantido. A variante sai da lista até a próxima mudança.',
    errorMessage: 'Não foi possível manter o preço.',
  });
}
