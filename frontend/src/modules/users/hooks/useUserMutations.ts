import { queryKeys } from '@/shared/react-query/keys';
import { useCrudMutation } from '@/shared/react-query/useCrudMutation';

import { createUser, resetUserPassword, updateUser } from '../services/userService';
import type { CreateUserInput, UpdateUserInput } from '../types';

// The forms display backend errors themselves (inline), so no default error toast.

export function useCreateUser() {
  return useCrudMutation({
    mutationFn: (input: CreateUserInput) => createUser(input),
    invalidateKeys: [queryKeys.users],
    successMessage: 'Usuário criado.',
    silentError: true,
  });
}

export function useUpdateUser(userId: string) {
  return useCrudMutation({
    mutationFn: (input: UpdateUserInput) => updateUser(userId, input),
    invalidateKeys: [queryKeys.users],
    successMessage: 'Usuário atualizado.',
    silentError: true,
  });
}

export function useResetUserPassword(userId: string) {
  return useCrudMutation({
    mutationFn: (password: string) => resetUserPassword(userId, password),
    successMessage: 'Senha redefinida.',
    silentError: true,
  });
}
