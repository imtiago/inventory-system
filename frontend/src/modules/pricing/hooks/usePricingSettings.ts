import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/shared/react-query/keys';

import { getPricingSettings } from '../services/pricingService';

export function usePricingSettings() {
  return useQuery({ queryKey: queryKeys.pricingSettings, queryFn: getPricingSettings });
}
