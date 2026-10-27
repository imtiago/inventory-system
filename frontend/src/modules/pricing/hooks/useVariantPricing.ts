import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/shared/react-query/keys';

import { getVariantPricing } from '../services/pricingService';

export function useVariantPricing(variantId: string) {
  return useQuery({
    queryKey: queryKeys.variantPricing(variantId),
    queryFn: () => getVariantPricing(variantId),
    enabled: !!variantId,
  });
}
