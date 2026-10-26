import { useForm } from 'react-hook-form';

import { Modal } from '@/shared/components/Modal/Modal';
import { useModalBusy } from '@/shared/components/Modal/useModalBusy';
import { parseApiErrorSync } from '@/shared/services/parseApiError';
import { applySubmitError } from '@/shared/utils/applyFieldErrors';

import { useChangeOwnPassword } from '../hooks/useChangeOwnPassword';

import { FieldError, fieldA11y } from '@/shared/components/form';
type Values = { currentPassword: string; newPassword: string; confirm: string };

const FIELDS = ['currentPassword', 'newPassword'] as const;
const inputClass = 'w-full rounded-lg border border-input bg-surface text-foreground p-3 outline-none focus:ring-2 focus:ring-ring/20';

function ChangePasswordForm({ onClose }: { onClose: () => void }) {
  const { mutateAsync } = useChangeOwnPassword();
  const {
    register,
    handleSubmit,
    getValues,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ defaultValues: { currentPassword: '', newPassword: '', confirm: '' } });

  useModalBusy(isSubmitting);

  const submit = handleSubmit(async ({ currentPassword, newPassword }) => {
    try {
      await mutateAsync({ currentPassword, newPassword });
      onClose();
    } catch (error) {
      if (applySubmitError(setError, error, FIELDS)) return;

      const { code, message } = parseApiErrorSync(error);

      if (code === 'INVALID_CURRENT_PASSWORD') {
        setError('currentPassword', { type: 'server', message });
      } else {
        setError('root.server', { type: 'server', message });
      }
    }
  });

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div>
        <label htmlFor="cp-current" className="mb-1 block font-medium">
          Senha atual
        </label>
        <input
          id="cp-current"
          type="password"
          autoComplete="current-password"
          {...fieldA11y("cp-current", errors.currentPassword?.message)}
          className={inputClass}
          {...register('currentPassword', { required: 'Informe a senha atual.' })}
        />
        <FieldError id="cp-current" message={errors.currentPassword?.message} />
      </div>

      <div>
        <label htmlFor="cp-new" className="mb-1 block font-medium">
          Nova senha
        </label>
        <input
          id="cp-new" {...fieldA11y("cp-new", errors.newPassword?.message)}
          type="password"
          autoComplete="new-password"
          className={inputClass}
          {...register('newPassword', {
            required: 'Informe a nova senha.',
            minLength: { value: 8, message: 'A senha deve ter no mínimo 8 caracteres.' },
            maxLength: { value: 72, message: 'A senha deve ter no máximo 72 caracteres.' },
          })}
        />
        <FieldError id="cp-new" message={errors.newPassword?.message} />
      </div>

      <div>
        <label htmlFor="cp-confirm" className="mb-1 block font-medium">
          Confirmar nova senha
        </label>
        <input
          id="cp-confirm" {...fieldA11y("cp-confirm", errors.confirm?.message)}
          type="password"
          autoComplete="new-password"
          className={inputClass}
          {...register('confirm', {
            required: 'Confirme a nova senha.',
            validate: (value) => value === getValues('newPassword') || 'As senhas não coincidem.',
          })}
        />
        <FieldError id="cp-confirm" message={errors.confirm?.message} />
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
          Alterar senha
        </button>
      </div>
    </form>
  );
}

export function ChangePasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Alterar senha" description="Informe sua senha atual e escolha uma nova.">
      <ChangePasswordForm onClose={onClose} />
    </Modal>
  );
}
