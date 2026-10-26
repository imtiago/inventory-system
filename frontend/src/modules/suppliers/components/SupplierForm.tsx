import { useSingleSubmit } from '@/shared/hooks/useSingleSubmit';
import { useForm } from 'react-hook-form';

import { applySubmitError } from '@/shared/utils/applyFieldErrors';
import { parseApiErrorSync } from '@/shared/services/parseApiError';
import { isValidDocumentFormat, maskDocument, maskSupplierPhone } from '../utils/formatDocument';
import type { ISupplier } from '../types';
import type { SupplierFormValues } from '../utils/diffSupplier';

interface Props {
  mode?: 'create' | 'edit';
  initialData?: ISupplier;
  onSubmit: (data: SupplierFormValues) => Promise<void>;
  onCancel: () => void;
}

const FIELDS = ['name', 'document', 'email', 'phone'] as const;
const inputClass = 'w-full rounded-lg border border-input bg-surface text-foreground p-3 outline-none focus:ring-2 focus:ring-ring/20 disabled:bg-surface-muted';

export function SupplierForm({ mode = 'create', initialData, onSubmit, onCancel }: Props) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SupplierFormValues>({
    defaultValues: {
      name: initialData?.name ?? '',
      document: maskDocument(initialData?.document),
      email: initialData?.email ?? '',
      phone: maskSupplierPhone(initialData?.phone),
    },
  });

  const once = useSingleSubmit();

  const submit = handleSubmit(once(async (data) => {
    try {
      await onSubmit(data);
    } catch (error) {
      const parsed = parseApiErrorSync(error);

      if (parsed.code === 'SUPPLIER_DOCUMENT_ALREADY_EXISTS') {
        setError('document', { type: 'server', message: parsed.message });
      } else if (!applySubmitError(setError, error, FIELDS)) {
        setError('root.server', { type: 'server', message: parsed.message });
      }
    }
  }));

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <section className="space-y-5 rounded-xl bg-surface p-6 shadow">
        <div>
          <label htmlFor="supplier-name" className="mb-1 block font-medium">
            Nome *
          </label>
          <input
            id="supplier-name"
            type="text"
            maxLength={120}
            aria-invalid={errors.name ? 'true' : undefined}
            {...register('name', {
              validate: (value) => {
                const length = value.trim().length;
                return (length >= 2 && length <= 120) || 'Informe o nome do fornecedor (2 a 120 caracteres).';
              },
            })}
            className={inputClass}
          />
          {errors.name && <p className="mt-1 text-sm text-danger">{errors.name.message}</p>}
        </div>

        <div>
          <label htmlFor="supplier-document" className="mb-1 block font-medium">
            Documento (CPF ou CNPJ) *
          </label>
          <input
            id="supplier-document"
            type="text"
            maxLength={18}
            aria-invalid={errors.document ? 'true' : undefined}
            {...register('document', {
              validate: (value) => isValidDocumentFormat(value) || 'Informe um CPF (11 dígitos) ou CNPJ (14 caracteres, os 2 últimos numéricos).',
              onChange: (event) => {
                const input = event.target as HTMLInputElement;
                input.value = maskDocument(input.value);
              },
            })}
            placeholder="00.000.000/0000-00"
            className={inputClass}
          />
          {errors.document && <p className="mt-1 text-sm text-danger">{errors.document.message}</p>}
        </div>

        <div>
          <label htmlFor="supplier-email" className="mb-1 block font-medium">
            E-mail
          </label>
          <input
            id="supplier-email"
            type="email"
            aria-invalid={errors.email ? 'true' : undefined}
            {...register('email', {
              validate: (value) => !value.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) || 'Informe um e-mail válido.',
            })}
            className={inputClass}
          />
          {errors.email && <p className="mt-1 text-sm text-danger">{errors.email.message}</p>}
        </div>

        <div>
          <label htmlFor="supplier-phone" className="mb-1 block font-medium">
            Telefone
          </label>
          <input
            id="supplier-phone"
            type="tel"
            maxLength={15}
            aria-invalid={errors.phone ? 'true' : undefined}
            {...register('phone', {
              validate: (value) => {
                const length = value.replace(/\D/g, '').length;
                return length === 0 || length === 10 || length === 11 || 'Informe um telefone com 10 ou 11 dígitos.';
              },
              onChange: (event) => {
                const input = event.target as HTMLInputElement;
                input.value = maskSupplierPhone(input.value);
              },
            })}
            placeholder="(11) 99999-9999"
            className={inputClass}
          />
          {errors.phone && <p className="mt-1 text-sm text-danger">{errors.phone.message}</p>}
        </div>
      </section>

      {errors.root?.server && (
        <div role="alert" className="rounded-lg border border-danger/30 bg-danger-soft p-4 text-sm text-danger">
          {errors.root.server.message}
        </div>
      )}

      <div className="flex flex-col-reverse justify-end gap-3 sm:flex-row">
        <button type="button" onClick={onCancel} disabled={isSubmitting} className="rounded-lg border px-5 py-3 hover:bg-surface-muted disabled:opacity-50">
          Cancelar
        </button>
        <button type="submit" disabled={isSubmitting} className="rounded-lg bg-primary px-5 py-3 font-medium text-primary-foreground hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50">
          {isSubmitting ? 'Salvando...' : mode === 'edit' ? 'Salvar alterações' : 'Cadastrar fornecedor'}
        </button>
      </div>
    </form>
  );
}
