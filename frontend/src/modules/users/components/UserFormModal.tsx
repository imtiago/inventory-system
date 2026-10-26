import { useSingleSubmit } from '@/shared/hooks/useSingleSubmit';
import { useForm } from 'react-hook-form';

import { Modal } from '@/shared/components/Modal/Modal';
import { useModalBusy } from '@/shared/components/Modal/useModalBusy';
import { parseApiErrorSync } from '@/shared/services/parseApiError';
import { applySubmitError } from '@/shared/utils/applyFieldErrors';
import { useAuthStore } from '@/shared/store/auth';
import type { UserRole } from '@/shared/auth/permissions';

import { useCreateUser, useUpdateUser } from '../hooks/useUserMutations';
import { ROLES, ROLE_LABELS, type UserDTO } from '../types';

import { FieldError, fieldA11y } from '@/shared/components/form';
import { passwordBytesRule } from '@/shared/utils/password';
type Values = { name: string; email: string; password: string; role: UserRole | ''; active: boolean };

const FIELDS = ['name', 'email', 'password', 'role'] as const;
const inputClass = 'w-full rounded-lg border border-input bg-surface text-foreground p-3 outline-none focus:ring-2 focus:ring-ring/20 disabled:bg-surface-muted';

interface FormProps {
  user: UserDTO | null;
  onClose: () => void;
}

function UserForm({ user, onClose }: FormProps) {
  const isEdit = user !== null;
  const currentUserId = useAuthStore((s) => s.user?.id);
  const isSelf = isEdit && user.id === currentUserId;

  const create = useCreateUser();
  const update = useUpdateUser(user?.id ?? '');

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    defaultValues: { name: user?.name ?? '', email: '', password: '', role: user?.role ?? '', active: user?.active ?? true },
  });

  const once = useSingleSubmit();
  useModalBusy(isSubmitting);

  const submit = handleSubmit(once(async (values) => {
    const name = values.name.trim();

    try {
      if (isEdit) {
        // Own access cannot be changed (the backend enforces it as well): send only the name.
        await update.mutateAsync(isSelf ? { name } : { name, role: values.role as UserRole, active: values.active });
      } else {
        await create.mutateAsync({ name, email: values.email.trim(), password: values.password, role: values.role as UserRole });
      }

      onClose();
    } catch (error) {
      if (applySubmitError(setError, error, FIELDS)) return;

      const { code, message } = parseApiErrorSync(error);

      if (code === 'EMAIL_ALREADY_IN_USE') {
        setError('email', { type: 'server', message });
      } else {
        setError('root.server', { type: 'server', message });
      }
    }
  }));

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div>
        <label htmlFor="user-name" className="mb-1 block font-medium">
          Nome *
        </label>
        <input
          id="user-name" {...fieldA11y("user-name", errors.name?.message)}
          type="text"
          maxLength={120}
          autoComplete="off"
          className={inputClass}
          {...register('name', {
            required: 'Informe o nome.',
            validate: (value) => value.trim().length > 0 || 'O nome não pode conter apenas espaços.',
          })}
        />
        <FieldError id="user-name" message={errors.name?.message} />
      </div>

      {isEdit ? (
        <div>
          <span className="mb-1 block font-medium">E-mail</span>
          <p className="rounded-lg bg-surface-muted p-3 text-foreground">{user.email}</p>
        </div>
      ) : (
        <>
          <div>
            <label htmlFor="user-email" className="mb-1 block font-medium">
              E-mail *
            </label>
            <input
              id="user-email" {...fieldA11y("user-email", errors.email?.message)}
              type="email"
              autoComplete="off"
              className={inputClass}
              {...register('email', {
                required: 'Informe o e-mail.',
                pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Informe um e-mail válido.' },
              })}
            />
            <FieldError id="user-email" message={errors.email?.message} />
          </div>

          <div>
            <label htmlFor="user-password" className="mb-1 block font-medium">
              Senha *
            </label>
            <input
              id="user-password" {...fieldA11y("user-password", errors.password?.message)}
              type="password"
              autoComplete="new-password"
              className={inputClass}
              {...register('password', {
                required: 'Informe a senha.',
                minLength: { value: 8, message: 'A senha deve ter no mínimo 8 caracteres.' },
                validate: passwordBytesRule,
              })}
            />
            <FieldError id="user-password" message={errors.password?.message} />
          </div>
        </>
      )}

      <div>
        <label htmlFor="user-role" className="mb-1 block font-medium">
          Papel *
        </label>
        <select id="user-role" {...fieldA11y("user-role", errors.role?.message)} disabled={isSelf} className={inputClass} {...register('role', { required: 'Selecione o papel.' })}>
          <option value="">Selecione...</option>
          {ROLES.map((role) => (
            <option key={role} value={role}>
              {ROLE_LABELS[role]}
            </option>
          ))}
        </select>
        <FieldError id="user-role" message={errors.role?.message} />
      </div>

      {isEdit && (
        <div>
          <label className="flex items-center gap-2 font-medium">
            <input type="checkbox" disabled={isSelf} {...register('active')} />
            Usuário ativo
          </label>
          {isSelf && <p className="mt-1 text-sm text-muted">Você não pode alterar o próprio acesso (papel e status).</p>}
        </div>
      )}

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
          {isEdit ? 'Salvar alterações' : 'Criar usuário'}
        </button>
      </div>
    </form>
  );
}

interface Props {
  open: boolean;
  /** null = create mode. */
  user: UserDTO | null;
  onClose: () => void;
}

export function UserFormModal({ open, user, onClose }: Props) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={user ? 'Editar usuário' : 'Novo usuário'}
      description={user ? 'Atualize nome, papel e status.' : 'Informe os dados do novo usuário.'}
    >
      <UserForm key={user?.id ?? 'new'} user={user} onClose={onClose} />
    </Modal>
  );
}
