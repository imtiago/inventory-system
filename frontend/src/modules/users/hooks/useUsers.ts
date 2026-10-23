import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/shared/react-query/keys';
import { getUsers } from '../services/userService';

export function useUsers(page: number, search = '') {
  return useQuery({
    queryKey: [...queryKeys.users, page, search],
    queryFn: () => getUsers(page, search.trim()),
    placeholderData: (previousData) => previousData,
  });
}
