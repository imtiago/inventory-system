import { applySubmitError } from '@/shared/utils/applyFieldErrors';
import { useForm } from 'react-hook-form';
import type { ICreateCustomerDTO } from '../types';

interface Props {
  loading?: boolean;
  error?: string | null;
  mode?: 'create' | 'edit';
  initialData?: Partial<ICreateCustomerDTO>;
  onSubmit: (data: ICreateCustomerDTO) => Promise<void>;
  onCancel: () => void;
}

// Aplica a máscara de telefone: (99) 99999-9999
function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);

  if (digits.length === 0) {
    return '';
  }

  if (digits.length <= 2) {
    return `(${digits}`;
  }

  if (digits.length <= 7) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  }

  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

const FIELDS = ['name', 'email', 'phone', 'address'] as const;

export function CustomerForm({ loading = false, error = null, mode = 'create', initialData, onSubmit, onCancel }: Props) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ICreateCustomerDTO>({
    defaultValues: {
      name: initialData?.name ?? '',
      email: initialData?.email ?? '',
      phone: maskPhone(initialData?.phone ?? ''),
      address: initialData?.address ?? '',
    },
  });

  const submit = handleSubmit(async (data) => {
    try {
      await onSubmit(data);
    } catch (error) {
      if (!applySubmitError(setError, error, FIELDS)) throw error;
    }
  });

  return (
    <form onSubmit={submit} className="space-y-6">
      <section className="space-y-5 rounded-xl bg-white p-6 shadow">
        {/* Nome */}
        <div>
          <label htmlFor="name" className="mb-1 block font-medium">
            Nome completo *
          </label>

          <input
            id="name"
            type="text"
            autoComplete="name"
            maxLength={150}
            {...register('name', {
              required: 'Informe o nome do cliente.',
              validate: (value) => value.trim().length > 0 || 'O nome não pode conter apenas espaços.',
            })}
            placeholder="Ex.: Maria da Silva"
            disabled={loading}
            className="w-full rounded-lg border p-3 outline-none focus:ring-2 focus:ring-gray-300 disabled:bg-gray-100"
          />

          {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>}
        </div>

        {/* E-mail */}
        <div>
          <label htmlFor="email" className="mb-1 block font-medium">
            E-mail
          </label>

          <input
            id="email"
            type="email"
            autoComplete="email"
            {...register('email', {
              setValueAs: (value: string) => value.trim() || null,
              validate: (value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || 'Informe um e-mail válido.',
            })}
            placeholder="cliente@exemplo.com"
            disabled={loading}
            className="w-full rounded-lg border p-3 outline-none focus:ring-2 focus:ring-gray-300 disabled:bg-gray-100"
          />

          {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>}
        </div>

        {/* Telefone com máscara */}
        <div>
          <label htmlFor="phone" className="mb-1 block font-medium">
            Telefone
          </label>

          <input
            id="phone"
            type="tel"
            autoComplete="tel"
            maxLength={15}
            {...register('phone', {
              setValueAs: (value: string) => {
                const digits = value.replace(/\D/g, '').slice(0, 11);
                return digits || null;
              },
              onChange: (event) => {
                const input = event.target as HTMLInputElement;
                input.value = maskPhone(input.value);
              },
            })}
            defaultValue={maskPhone(initialData?.phone ?? '')}
            placeholder="(68) 99999-9999"
            disabled={loading}
            className="w-full rounded-lg border p-3 outline-none focus:ring-2 focus:ring-gray-300 disabled:bg-gray-100"
          />
        </div>

        {/* Endereço */}
        <div>
          <label htmlFor="address" className="mb-1 block font-medium">
            Endereço
          </label>

          <textarea
            id="address"
            rows={3}
            autoComplete="street-address"
            {...register('address', {
              setValueAs: (value: string) => value.trim() || null,
            })}
            placeholder="Rua, número, bairro, cidade..."
            disabled={loading}
            className="w-full resize-y rounded-lg border p-3 outline-none focus:ring-2 focus:ring-gray-300 disabled:bg-gray-100"
          />
        </div>
      </section>


      {errors.root?.server && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {errors.root.server.message}
        </div>
      )}

      {/* Mensagem de erro */}
      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Botões */}
      <div className="flex flex-col-reverse justify-end gap-3 sm:flex-row">
        <button type="button" onClick={onCancel} disabled={loading} className="rounded-lg border px-5 py-3 hover:bg-gray-50 disabled:opacity-50">
          Cancelar
        </button>

        <button type="submit" disabled={loading} className="rounded-lg bg-gray-900 px-5 py-3 font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50">
          {loading ? (mode === 'edit' ? 'Salvando...' : 'Cadastrando...') : mode === 'edit' ? 'Salvar alterações' : 'Cadastrar cliente'}
        </button>
      </div>
    </form>
  );
}
