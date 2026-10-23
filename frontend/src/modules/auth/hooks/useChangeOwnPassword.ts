import { useCrudMutation } from '@/shared/react-query/useCrudMutation';
import { changeOwnPassword } from '@/modules/users/services/userService';

export function useChangeOwnPassword() {
  return useCrudMutation({
    mutationFn: changeOwnPassword,
    successMessage: 'Senha alterada com sucesso.',
    silentError: true,
  });
}
