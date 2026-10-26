import { useSingleSubmit } from '@/shared/hooks/useSingleSubmit';
import { applySubmitError } from '@/shared/utils/applyFieldErrors';
import { parseApiErrorSync } from '@/shared/services/parseApiError';
import { useForm } from 'react-hook-form';
import { isValidDocumentFormat, maskDocument, normalizeDocument } from '@/modules/suppliers/utils/formatDocument';
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

const FIELDS = ['name', 'document', 'email', 'phone', 'address'] as const;

export function CustomerForm({ loading = false, error = null, mode = 'create', initialData, onSubmit, onCancel }: Props) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ICreateCustomerDTO>({
    defaultValues: {
      name: initialData?.name ?? '',
      document: maskDocument(initialData?.document),
      email: initialData?.email ?? '',
      phone: maskPhone(initialData?.phone ?? ''),
      address: initialData?.address ?? '',
    },
  });

  const busy = loading || isSubmitting;
  const once = useSingleSubmit();

  const submit = handleSubmit(once(async (data) => {
    try {
      await onSubmit(data);
    } catch (error) {
      // Field errors go inline; anything else is shown in the form (mutations are silent).
      const parsed = parseApiErrorSync(error);

      if (parsed.code === 'CUSTOMER_DOCUMENT_EXISTS') {
        setError('document', { type: 'server', message: parsed.message });
      } else if (!applySubmitError(setError, error, FIELDS)) {
        setError('root.server', { type: 'server', message: parsed.message });
      }
    }
  }));

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      <section className="space-y-5 rounded-xl bg-surface p-6 shadow">
        {/* Nome */}
        <div>
          <label htmlFor="name" className="mb-1 block font-medium">
            Nome completo *
          </label>

          <input
            id="name"
            aria-invalid={errors.name ? 'true' : undefined}
            aria-describedby={errors.name ? 'name-error' : undefined}
            type="text"
            autoComplete="name"
            maxLength={150}
            {...register('name', {
              required: 'Informe o nome do cliente.',
              validate: (value) => value.trim().length > 0 || 'O nome não pode conter apenas espaços.',
            })}
            placeholder="Ex.: Maria da Silva"
            disabled={busy}
            className="w-full rounded-lg border p-3 outline-none focus:ring-2 focus:ring-ring/20 disabled:bg-surface-muted"
          />

          {errors.name && <p id="name-error" className="mt-1 text-sm text-danger">{errors.name.message}</p>}
        </div>

        {/* CPF/CNPJ com máscara */}
        <div>
          <label htmlFor="document" className="mb-1 block font-medium">
            CPF/CNPJ
          </label>

          <input
            id="document"
            aria-invalid={errors.document ? 'true' : undefined}
            aria-describedby={errors.document ? 'document-error' : undefined}
            type="text"
            inputMode="text"
            autoComplete="off"
            maxLength={18}
            {...register('document', {
              setValueAs: (value: string) => normalizeDocument(value) || null,
              validate: (value) => !value || isValidDocumentFormat(value) || 'Informe um CPF (11 dígitos) ou CNPJ (14 caracteres, os 2 últimos numéricos).',
              onChange: (event) => {
                const input = event.target as HTMLInputElement;
                input.value = maskDocument(input.value);
              },
            })}
            placeholder="000.000.000-00"
            disabled={busy}
            className="w-full rounded-lg border p-3 outline-none focus:ring-2 focus:ring-ring/20 disabled:bg-surface-muted"
          />

          {errors.document && (
            <p id="document-error" className="mt-1 text-sm text-danger">
              {errors.document.message}
            </p>
          )}
        </div>

        {/* E-mail */}
        <div>
          <label htmlFor="email" className="mb-1 block font-medium">
            E-mail
          </label>

          <input
            id="email"
            aria-invalid={errors.email ? 'true' : undefined}
            aria-describedby={errors.email ? 'email-error' : undefined}
            type="email"
            autoComplete="email"
            {...register('email', {
              setValueAs: (value: string) => value.trim() || null,
              validate: (value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || 'Informe um e-mail válido.',
            })}
            placeholder="cliente@exemplo.com"
            disabled={busy}
            className="w-full rounded-lg border p-3 outline-none focus:ring-2 focus:ring-ring/20 disabled:bg-surface-muted"
          />

          {errors.email && <p id="email-error" className="mt-1 text-sm text-danger">{errors.email.message}</p>}
        </div>

        {/* Telefone com máscara */}
        <div>
          <label htmlFor="phone" className="mb-1 block font-medium">
            Telefone
          </label>

          <input
            id="phone"
            aria-invalid={errors.phone ? 'true' : undefined}
            aria-describedby={errors.phone ? 'phone-error' : undefined}
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
            disabled={busy}
            className="w-full rounded-lg border p-3 outline-none focus:ring-2 focus:ring-ring/20 disabled:bg-surface-muted"
          />
          {errors.phone && (
            <p id="phone-error" className="mt-1 text-sm text-danger">
              {errors.phone.message}
            </p>
          )}
        </div>

        {/* Endereço */}
        <div>
          <label htmlFor="address" className="mb-1 block font-medium">
            Endereço
          </label>

          <textarea
            id="address"
            aria-invalid={errors.address ? 'true' : undefined}
            aria-describedby={errors.address ? 'address-error' : undefined}
            rows={3}
            autoComplete="street-address"
            {...register('address', {
              setValueAs: (value: string) => value.trim() || null,
            })}
            placeholder="Rua, número, bairro, cidade..."
            disabled={busy}
            className="w-full resize-y rounded-lg border p-3 outline-none focus:ring-2 focus:ring-ring/20 disabled:bg-surface-muted"
          />
          {errors.address && (
            <p id="address-error" className="mt-1 text-sm text-danger">
              {errors.address.message}
            </p>
          )}
        </div>
      </section>


      {errors.root?.server && (
        <div role="alert" className="rounded-lg border border-danger/30 bg-danger-soft p-4 text-sm text-danger">
          {errors.root.server.message}
        </div>
      )}

      {/* Mensagem de erro */}
      {error && (
        <div role="alert" className="rounded-lg border border-danger/30 bg-danger-soft p-4 text-sm text-danger">
          {error}
        </div>
      )}

      {/* Botões */}
      <div className="flex flex-col-reverse justify-end gap-3 sm:flex-row">
        <button type="button" onClick={onCancel} disabled={busy} className="rounded-lg border px-5 py-3 hover:bg-surface-muted disabled:opacity-50">
          Cancelar
        </button>

        <button type="submit" disabled={busy} className="rounded-lg bg-primary px-5 py-3 font-medium text-primary-foreground hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50">
          {busy ? (mode === 'edit' ? 'Salvando...' : 'Cadastrando...') : mode === 'edit' ? 'Salvar alterações' : 'Cadastrar cliente'}
        </button>
      </div>
    </form>
  );
}
