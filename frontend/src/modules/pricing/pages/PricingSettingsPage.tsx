import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Info } from 'lucide-react';

import { Section } from '@/shared/components/details/Section';
import { FieldError, PercentInput, fieldA11y } from '@/shared/components/form';
import { LoadingState } from '@/shared/components/LoadingState';
import { Page } from '@/shared/components/layout/Page';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { useSingleSubmit } from '@/shared/hooks/useSingleSubmit';
import { parseApiErrorSync } from '@/shared/services/parseApiError';
import { applySubmitError } from '@/shared/utils/applyFieldErrors';
import { formatPercentInput, percentTextError, percentTextToBps } from '@/shared/utils/percent';

import { CardFeesFields } from '../components/CardFeesFields';
import { ExpenseList } from '../components/ExpenseList';
import { usePricingSettings } from '../hooks/usePricingSettings';
import { useSavePricingSettings } from '../hooks/usePricingMutations';
import type { PricingSettings, RoundingStrategy, SettingsFormValues } from '../types';

const ROUNDING_OPTIONS: { value: RoundingStrategy; label: string }[] = [
  { value: 'STORE_TABLE', label: 'Tabela da loja (,50 / ,90 por faixa de preço)' },
  { value: 'END_90', label: 'Terminar em ,90' },
  { value: 'END_99', label: 'Terminar em ,99' },
  { value: 'INTEGER', label: 'Número inteiro (sobe para o próximo real)' },
  { value: 'NONE', label: 'Sem arredondamento' },
];

const fieldClass = 'w-full min-h-11 rounded-lg border border-input bg-surface p-3 text-base text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 sm:text-sm';
const validate = (value: string) => percentTextError(value) ?? true;

function toFormValues(settings: PricingSettings): SettingsFormValues {
  return {
    // Sem configuração salva a margem começa vazia: a loja precisa escolher, não herdar 0%.
    defaultMargin: settings.configured ? formatPercentInput(settings.defaultMarginPercent) : '',
    roundingStrategy: settings.roundingStrategy,
    alertThreshold: formatPercentInput(settings.alertThresholdPercent),
    debit: formatPercentInput(settings.cardFees.debitPercent),
    credit: Array.from({ length: 12 }, (_, i) => formatPercentInput(settings.cardFees.creditPercent[String(i + 1)] ?? 0)),
  };
}

const toPercent = (text: string) => (percentTextToBps(text) ?? 0) / 100;

export function PricingSettingsPage() {
  const { data: settings, isLoading, isError } = usePricingSettings();

  return (
    <Page width="narrow">
      <PageHeader title="Configurações de preço" description="Margem, despesas, arredondamento e taxas de cartão usados no preço sugerido." />

      {isLoading ? (
        <LoadingState label="Carregando configurações..." />
      ) : isError || !settings ? (
        <p role="alert" className="rounded-xl border border-danger/30 bg-danger-soft p-4 text-sm text-danger">
          Não foi possível carregar as configurações de preço.
        </p>
      ) : (
        <>
          {!settings.configured && (
            <div role="status" className="flex items-start gap-3 rounded-xl border border-info/30 bg-info-soft p-4 text-sm text-info">
              <Info size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
              <p>Preencha as configurações para ver preços sugeridos</p>
            </div>
          )}

          <SettingsForm settings={settings} />
          <ExpenseList expenses={settings.expenses} totalPercent={settings.expensesTotalPercent} />
        </>
      )}
    </Page>
  );
}

function SettingsForm({ settings }: { settings: PricingSettings }) {
  const save = useSavePricingSettings();
  const once = useSingleSubmit();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<SettingsFormValues>({ defaultValues: toFormValues(settings) });

  // Depois de salvar (ou mudar despesas) o servidor devolve os valores oficiais.
  useEffect(() => {
    reset(toFormValues(settings));
  }, [settings, reset]);

  const submit = handleSubmit(
    once(async (values) => {
      clearErrors('root.server');
      const creditPercent = Object.fromEntries(values.credit.map((text, i) => [String(i + 1), toPercent(text)]));

      try {
        await save.mutateAsync({
          defaultMarginPercent: toPercent(values.defaultMargin),
          roundingStrategy: values.roundingStrategy,
          alertThresholdPercent: toPercent(values.alertThreshold),
          cardFees: { debitPercent: toPercent(values.debit), creditPercent },
        });
      } catch (error) {
        if (applySubmitError(setError, error, [])) return;

        // Ex.: 422 "Despesas e margem somam 100% ou mais".
        setError('root.server', { type: 'server', message: parseApiErrorSync(error).message });
      }
    }),
  );

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      {errors.root?.server && (
        <div role="alert" className="rounded-xl border border-danger/30 bg-danger-soft p-4 text-sm text-danger">
          {errors.root.server.message}
        </div>
      )}

      <Section title="Margem e arredondamento">
        <div className="grid grid-cols-1 gap-5 p-4 sm:p-6 md:grid-cols-2">
          <div>
            <label htmlFor="pricing-default-margin" className="mb-1 block font-medium">
              Margem padrão (%)
            </label>
            <PercentInput id="pricing-default-margin" {...fieldA11y('pricing-default-margin', errors.defaultMargin?.message)} {...register('defaultMargin', { validate })} />
            <p className="mt-1 text-sm text-muted">Vale quando a variante, o produto e a categoria não têm margem própria.</p>
            <FieldError id="pricing-default-margin" message={errors.defaultMargin?.message} />
          </div>

          <div>
            <label htmlFor="pricing-alert" className="mb-1 block font-medium">
              Limite de alerta (pontos)
            </label>
            <PercentInput id="pricing-alert" {...fieldA11y('pricing-alert', errors.alertThreshold?.message)} {...register('alertThreshold', { validate })} />
            <p className="mt-1 text-sm text-muted">Quantos pontos de margem abaixo da desejada levam o preço para a revisão.</p>
            <FieldError id="pricing-alert" message={errors.alertThreshold?.message} />
          </div>

          <div className="md:col-span-2">
            <label htmlFor="pricing-rounding" className="mb-1 block font-medium">
              Estratégia de arredondamento
            </label>
            <select id="pricing-rounding" className={fieldClass} {...register('roundingStrategy')}>
              {ROUNDING_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Section>

      <Section title="Taxas de cartão" description="Percentual cobrado pela operadora em cada forma de pagamento.">
        <CardFeesFields register={register} errors={errors} />
      </Section>

      <div className="flex justify-end">
        <button type="submit" disabled={isSubmitting} className="min-h-11 w-full rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-50 sm:w-auto">
          {isSubmitting ? 'Salvando...' : 'Salvar configurações'}
        </button>
      </div>
    </form>
  );
}
