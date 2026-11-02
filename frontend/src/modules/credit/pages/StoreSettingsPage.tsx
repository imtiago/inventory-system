import { useForm } from 'react-hook-form';

import { FieldError, fieldA11y } from '@/shared/components/form';
import { Section } from '@/shared/components/details/Section';
import { LoadingState } from '@/shared/components/LoadingState';
import { Page } from '@/shared/components/layout/Page';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { maskDocument, normalizeDocument, maskSupplierPhone } from '@/modules/suppliers/utils/formatDocument';
import { applySubmitError } from '@/shared/utils/applyFieldErrors';
import { parseApiErrorSync } from '@/shared/services/parseApiError';
import { formatDateTime } from '@/shared/utils/formatDateTime';

import { inputClass } from '../components/CreditField';
import { useSaveStoreSettings, useStoreSettings } from '../hooks/useCredit';
import type { StoreSettings } from '../types';

interface FormValues {
  name: string;
  cnpj: string;
  address: string;
  phone: string;
}

const FIELDS = ['name', 'cnpj', 'address', 'phone'] as const;

const toValues = (s: StoreSettings): FormValues => ({
  name: s.name,
  cnpj: maskDocument(s.cnpj),
  address: s.address,
  phone: maskSupplierPhone(s.phone),
});

function StoreForm({ settings }: { settings: StoreSettings }) {
  const save = useSaveStoreSettings();
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ defaultValues: toValues(settings) });

  const submit = handleSubmit(async (values) => {
    try {
      await save.mutateAsync({
        name: values.name.trim(),
        cnpj: normalizeDocument(values.cnpj),
        address: values.address.trim(),
        phone: values.phone.replace(/\D/g, ''),
      });
    } catch (error) {
      if (!applySubmitError(setError, error, FIELDS)) setError('root.server', { type: 'server', message: parseApiErrorSync(error).message });
    }
  });

  const field = (name: (typeof FIELDS)[number]) => fieldA11y(`store-${name}`, errors[name]?.message);

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4 p-4 sm:p-6">
      {!settings.configured && (
        <p role="status" className="rounded-lg border border-warning/30 bg-warning-soft p-3 text-sm text-warning">
          Os dados da loja ainda não foram preenchidos. Sem eles não é possível emitir carnê e recibo nem ativar o crediário.
        </p>
      )}

      {errors.root?.server && (
        <p role="alert" className="rounded-lg border border-danger/30 bg-danger-soft p-3 text-sm text-danger">
          {errors.root.server.message}
        </p>
      )}

      <div className="min-w-0">
        <label htmlFor="store-name" className="mb-1 block font-medium">
          Nome da loja
        </label>
        <input id="store-name" type="text" autoComplete="organization" maxLength={120} className={inputClass} {...field('name')} {...register('name', { validate: (v) => (v.trim().length >= 2 ? true : 'Informe o nome da loja.') })} />
        <FieldError id="store-name" message={errors.name?.message} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="min-w-0">
          <label htmlFor="store-cnpj" className="mb-1 block font-medium">
            CNPJ
          </label>
          <input
            id="store-cnpj"
            type="text"
            inputMode="text"
            autoComplete="off"
            className={inputClass}
            {...field('cnpj')}
            {...register('cnpj', {
              validate: (v) => (/^[0-9A-Z]{12}\d{2}$/.test(normalizeDocument(v)) ? true : 'Informe um CNPJ válido.'),
              onChange: (e) => setValue('cnpj', maskDocument(e.target.value)),
            })}
          />
          <FieldError id="store-cnpj" message={errors.cnpj?.message} />
        </div>

        <div className="min-w-0">
          <label htmlFor="store-phone" className="mb-1 block font-medium">
            Telefone
          </label>
          <input
            id="store-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            className={inputClass}
            {...field('phone')}
            {...register('phone', {
              validate: (v) => (/^\d{10,11}$/.test(v.replace(/\D/g, '')) ? true : 'Informe o telefone com DDD.'),
              onChange: (e) => setValue('phone', maskSupplierPhone(e.target.value)),
            })}
          />
          <FieldError id="store-phone" message={errors.phone?.message} />
        </div>
      </div>

      <div className="min-w-0">
        <label htmlFor="store-address" className="mb-1 block font-medium">
          Endereço
        </label>
        <input id="store-address" type="text" autoComplete="street-address" maxLength={250} className={inputClass} {...field('address')} {...register('address', { validate: (v) => (v.trim().length >= 5 ? true : 'Informe o endereço da loja.') })} />
        <FieldError id="store-address" message={errors.address?.message} />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted">{settings.updatedAt ? `Atualizado em ${formatDateTime(settings.updatedAt)}.` : 'Aparece no cabeçalho do carnê e do recibo.'}</p>
        <button type="submit" disabled={isSubmitting} className="min-h-11 rounded-lg bg-primary px-6 py-2 font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-50">
          {isSubmitting ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </form>
  );
}

/** Dados da loja que saem no carnê e no recibo (nome, CNPJ, endereço e telefone). */
export function StoreSettingsPage() {
  const { data: settings, isLoading, isError } = useStoreSettings();

  return (
    <Page width="narrow">
      <PageHeader title="Dados da loja" description="Identificação que sai no carnê e no recibo." />

      {isLoading ? (
        <LoadingState label="Carregando dados da loja..." />
      ) : isError || !settings ? (
        <p role="alert" className="rounded-xl border border-danger/30 bg-danger-soft p-4 text-sm text-danger">
          Não foi possível carregar os dados da loja.
        </p>
      ) : (
        <Section title="Loja">
          <StoreForm key={settings.updatedAt ?? 'novo'} settings={settings} />
        </Section>
      )}
    </Page>
  );
}
