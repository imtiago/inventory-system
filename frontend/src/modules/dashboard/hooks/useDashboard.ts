import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/shared/react-query/keys';
import { getDashboard } from '../services/dashboardService';

export function useDashboard() {
  return useQuery({ queryKey: queryKeys.dashboard, queryFn: getDashboard });
}
