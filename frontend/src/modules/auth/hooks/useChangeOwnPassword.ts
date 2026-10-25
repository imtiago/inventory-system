import { useCrudMutation } from '@/shared/react-query/useCrudMutation';
import { changeOwnPassword } from '@/modules/users/services/userService';
import { useAuthStore } from '@/shared/store/auth';

export function useChangeOwnPassword() {
  return useCrudMutation({
    // The old token stops working after the change: keep this tab signed in with the new one.
    mutationFn: async (input: { currentPassword: string; newPassword: string }) => {
      const { token } = await changeOwnPassword(input);
      useAuthStore.getState().setToken(token);
    },
    successMessage: 'Senha alterada com sucesso.',
    silentError: true,
  });
}
