import { useSingleSubmit } from '@/shared/hooks/useSingleSubmit';
import { useForm } from 'react-hook-form';

import { Modal } from '@/shared/components/Modal/Modal';
import { useModalBusy } from '@/shared/components/Modal/useModalBusy';
import { parseApiErrorSync } from '@/shared/services/parseApiError';
import { applySubmitError } from '@/shared/utils/applyFieldErrors';

import { useResetUserPassword } from '../hooks/useUserMutations';
import type { UserDTO } from '../types';

type Values = { password: string; confirm: string };

const FIELDS = ['password'] as const;
const inputClass = 'w-full rounded-lg border border-input bg-surface text-foreground p-3 outline-none focus:ring-2 focus:ring-ring/20 disabled:bg-surface-muted';

interface Props {
  user: UserDTO | null;
  onClose: () => void;
}

function ResetPasswordForm({ user, onClose }: { user: UserDTO; onClose: () => void }) {
  const { mutateAsync } = useResetUserPassword(user.id);
  const {
    register,
    handleSubmit,
    getValues,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ defaultValues: { password: '', confirm: '' } });

  const once = useSingleSubmit();
  useModalBusy(isSubmitting);

  const submit = handleSubmit(once(async ({ password }) => {
    try {
      await mutateAsync(password);
      onClose();
    } catch (error) {
      if (!applySubmitError(setError, error, FIELDS)) {
        setError('root.server', { type: 'server', message: parseApiErrorSync(error).message });
      }
    }
  }));

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div>
        <label htmlFor="reset-password" className="mb-1 block font-medium">
          Nova senha
        </label>
        <input
          id="reset-password"
          type="password"
          autoComplete="new-password"
          aria-describedby={errors.password ? 'reset-password-error' : undefined}
          className={inputClass}
          {...register('password', {
            required: 'Informe a nova senha.',
            minLength: { value: 8, message: 'A senha deve ter no mínimo 8 caracteres.' },
            maxLength: { value: 72, message: 'A senha deve ter no máximo 72 caracteres.' },
          })}
        />
        {errors.password && (
          <p id="reset-password-error" className="mt-1 text-sm text-danger">
            {errors.password.message}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="reset-confirm" className="mb-1 block font-medium">
          Confirmar nova senha
        </label>
        <input
          id="reset-confirm"
          type="password"
          autoComplete="new-password"
          className={inputClass}
          {...register('confirm', {
            required: 'Confirme a nova senha.',
            validate: (value) => value === getValues('password') || 'As senhas não coincidem.',
          })}
        />
        {errors.confirm && <p className="mt-1 text-sm text-danger">{errors.confirm.message}</p>}
      </div>

      {errors.root?.server && (
        <div role="alert" className="rounded-lg border border-danger/30 bg-danger-soft p-4 text-sm text-danger">
          {errors.root.server.message}
        </div>
      )}

      <div className="flex flex-col-reverse justify-end gap-3 sm:flex-row">
        <button type="button" onClick={onClose} className="rounded-lg border px-5 py-3 hover:bg-surface-muted">
          Cancelar
        </button>
        <button type="submit" disabled={isSubmitting} className="rounded-lg bg-primary px-5 py-3 font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-50">
          Redefinir senha
        </button>
      </div>
    </form>
  );
}

export function ResetPasswordModal({ user, onClose }: Props) {
  return (
    <Modal open={user !== null} onClose={onClose} title="Redefinir senha" description={user ? `Defina uma nova senha para ${user.name}.` : undefined}>
      {user && <ResetPasswordForm key={user.id} user={user} onClose={onClose} />}
    </Modal>
  );
}
