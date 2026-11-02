import { useEffect } from 'react';
import { useForm } from 'react-hook-form';

import { Section } from '@/shared/components/details/Section';
import { useSingleSubmit } from '@/shared/hooks/useSingleSubmit';
import { parseApiErrorSync } from '@/shared/services/parseApiError';
import { moneyTextError } from '@/shared/utils/money';

import { useSaveCreditSettings } from '../hooks/useCredit';
import { CREDIT_PROFILE_NAMES, type CreditProfileCode, type CreditSettings } from '../types';
import { intError, MAX_FINE_BPS, MAX_INSTALLMENTS, percentRangeError, toFormValues, toRules, type RulesFormValues, type WeightValues } from '../utils/rulesForm';
import { CreditBandsEditor } from './CreditBandsEditor';
import { CreditField } from './CreditField';

const AUTO_PROFILES: CreditProfileCode[] = ['NEW', 'REGULAR', 'GOOD', 'EXCELLENT'];
const GRID = 'grid grid-cols-1 gap-5 p-4 sm:p-6 md:grid-cols-2';

const WEIGHT_FIELDS: { key: keyof WeightValues; label: string; hint?: string }[] = [
  { key: 'paidOnTime', label: 'Pontos por parcela paga em dia' },
  { key: 'relationshipMonth', label: 'Pontos por mês de relacionamento' },
  { key: 'relationshipMonthsCap', label: 'Máximo de meses contados' },
  { key: 'per100Paid', label: 'Pontos a cada R$ 100 pagos' },
  { key: 'per100PaidCap', label: 'Máximo de pontos por valor pago' },
  { key: 'dayLate', label: 'Pontos por dia de atraso', hint: 'Use número negativo para descontar.' },
  { key: 'paidLate30', label: 'Pontos por parcela paga com mais de 30 dias de atraso', hint: 'Use número negativo para descontar.' },
  { key: 'renegotiation', label: 'Pontos por renegociação', hint: 'Use número negativo para descontar.' },
];

const days = { min: 0, max: 365 };

export function CreditRulesForm({ settings }: { settings: CreditSettings }) {
  const save = useSaveCreditSettings();
  const once = useSingleSubmit();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    clearErrors,
    control,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<RulesFormValues>({ defaultValues: toFormValues(settings.rules) });

  // Depois de salvar, o servidor devolve os valores oficiais.
  useEffect(() => {
    reset(toFormValues(settings.rules));
  }, [settings.rules, reset]);

  const int = (name: keyof RulesFormValues & string, options: Parameters<typeof intError>[1]) =>
    register(name as 'graceDays', { validate: (v: string) => intError(v, options) ?? true });

  const submit = handleSubmit(
    once(async (values) => {
      clearErrors('root.server');

      try {
        await save.mutateAsync({ rules: toRules(values) });
      } catch (error) {
        // Ex.: 422 FINE_ABOVE_LEGAL_LIMIT.
        setError('root.server', { type: 'server', message: parseApiErrorSync(error).message });
      }
    }),
  );

  const weightError = (key: keyof WeightValues) => errors.weights?.[key]?.message;
  const autoProfilesId = 'credit-auto-profiles';

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      {errors.root?.server && (
        <div role="alert" className="rounded-xl border border-danger/30 bg-danger-soft p-4 text-sm text-danger">
          {errors.root.server.message}
        </div>
      )}

      <Section title="Faixas de parcelamento" description="Máximo de parcelas conforme o valor financiado.">
        <CreditBandsEditor control={control} register={register} getValues={getValues} errors={errors} />
      </Section>

      <Section title="Parcelas e juros" description="Parcela mínima, parcelas sem acréscimo e taxa mensal da tabela de preço.">
        <div className={GRID}>
          <CreditField id="credit-min-installment" label="Parcela mínima (R$)" kind="money" registration={register('minInstallment', { validate: (v) => moneyTextError(v) ?? true })} error={errors.minInstallment?.message} />
          <CreditField
            id="credit-free-installments"
            label="Parcelas sem acréscimo"
            kind="int"
            hint="Até esse número de parcelas o preço não muda."
            registration={int('interestFreeInstallments', { min: 0, max: MAX_INSTALLMENTS })}
            error={errors.interestFreeInstallments?.message}
          />
          <CreditField
            id="credit-monthly-rate"
            label="Taxa mensal (%)"
            kind="percent"
            hint="Acréscimo ao mês nas parcelas acima das sem acréscimo."
            registration={register('monthlyRate', { validate: (v) => percentRangeError(v, 9999, 'A taxa deve ser menor que 100%') ?? true })}
            error={errors.monthlyRate?.message}
          />
          <CreditField
            id="credit-due-day"
            label="Dia fixo de vencimento"
            kind="int"
            hint="De 1 a 28. Em branco, vence a cada 30 dias a partir da compra."
            registration={register('defaultDueDay', { validate: (v) => intError(v, { min: 1, max: 28, optional: true }) ?? true })}
            error={errors.defaultDueDay?.message}
          />
        </div>
      </Section>

      <Section title="Atraso e cobrança" description="Bloqueio por atraso, multa, juros e carência.">
        <div className={GRID}>
          <CreditField
            id="credit-block-days"
            label="Bloquear compra após (dias de atraso)"
            kind="int"
            hint="Cliente com parcela atrasada além disso não compra no crediário."
            registration={int('overdueBlockDays', days)}
            error={errors.overdueBlockDays?.message}
          />
          <CreditField id="credit-grace-days" label="Carência (dias)" kind="int" hint="Dias após o vencimento sem multa e juros." registration={int('graceDays', { min: 0, max: 60 })} error={errors.graceDays?.message} />
          <CreditField
            id="credit-fine"
            label="Multa por atraso (%)"
            kind="percent"
            hint="Máximo de 2% (limite legal)."
            registration={register('fine', { validate: (v) => percentRangeError(v, MAX_FINE_BPS, 'A multa não pode passar de 2%') ?? true })}
            error={errors.fine?.message}
          />
          <CreditField
            id="credit-interest"
            label="Juros por atraso (% ao mês)"
            kind="percent"
            hint="Cobrado proporcional aos dias de atraso."
            registration={register('monthlyInterest', { validate: (v) => percentRangeError(v, 9999, 'Os juros devem ser menores que 100%') ?? true })}
            error={errors.monthlyInterest?.message}
          />
        </div>
      </Section>

      <Section title="Aprovação automática" description="Pedido de aumento de limite que dispensa a análise de um aprovador.">
        <div className={GRID}>
          <fieldset className="min-w-0 md:col-span-2">
            <legend className="mb-1 block font-medium">Perfis aprovados automaticamente</legend>
            <div className="flex flex-wrap gap-x-6 gap-y-1">
              {AUTO_PROFILES.map((code) => (
                <label key={code} className="flex min-h-11 items-center gap-2">
                  <input type="checkbox" value={code} className="h-5 w-5 accent-primary" aria-describedby={autoProfilesId} {...register('autoProfiles')} />
                  {CREDIT_PROFILE_NAMES[code]}
                </label>
              ))}
            </div>
            <p id={autoProfilesId} className="text-sm text-muted">
              Sem nenhum perfil marcado, todo pedido vai para um aprovador.
            </p>
          </fieldset>
          <CreditField id="credit-auto-days-late" label="Atraso máximo nos últimos 12 meses (dias)" kind="int" registration={int('autoMaxDaysLate', days)} error={errors.autoMaxDaysLate?.message} />
          <CreditField id="credit-auto-paid" label="Mínimo de parcelas pagas" kind="int" registration={int('autoMinPaid', { min: 0, max: 1000 })} error={errors.autoMinPaid?.message} />
          <CreditField
            id="credit-auto-increase"
            label="Pedido de até (% acima do limite)"
            kind="percent"
            hint="Quanto o pedido pode passar do limite atual para ser aprovado sozinho."
            registration={register('autoMaxIncrease', { validate: (v) => percentRangeError(v, 99999, 'O máximo é 999,99%') ?? true })}
            error={errors.autoMaxIncrease?.message}
          />
        </div>
      </Section>

      <Section title="Pontuação do cliente" description="Pontos que decidem a subida ou a queda de perfil nas revisões.">
        <div className={GRID}>
          {WEIGHT_FIELDS.map(({ key, label, hint }) => (
            <CreditField
              key={key}
              id={`credit-weight-${key}`}
              label={label}
              kind="int"
              hint={hint}
              registration={register(`weights.${key}`, { validate: (v) => intError(v, { min: -1000, max: key.endsWith('Cap') ? 100000 : 1000 }) ?? true })}
              error={weightError(key)}
            />
          ))}
          <CreditField id="credit-promote-new" label="Pontos para sair de Novo" kind="int" registration={int('promoteNew', { min: -100000, max: 100000 })} error={errors.promoteNew?.message} />
          <CreditField id="credit-promote-regular" label="Pontos para sair de Regular" kind="int" registration={int('promoteRegular', { min: -100000, max: 100000 })} error={errors.promoteRegular?.message} />
          <CreditField id="credit-promote-good" label="Pontos para sair de Bom" kind="int" registration={int('promoteGood', { min: -100000, max: 100000 })} error={errors.promoteGood?.message} />
          <CreditField id="credit-demote-days" label="Rebaixar com atraso acima de (dias)" kind="int" registration={int('demoteDays', { min: 0, max: 3650 })} error={errors.demoteDays?.message} />
          <CreditField id="credit-suspend-days" label="Suspender com atraso acima de (dias)" kind="int" registration={int('suspendDays', { min: 0, max: 3650 })} error={errors.suspendDays?.message} />
        </div>
      </Section>

      <div className="flex justify-end">
        <button type="submit" disabled={isSubmitting} className="min-h-11 w-full rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-50 sm:w-auto">
          {isSubmitting ? 'Salvando...' : 'Salvar regras'}
        </button>
      </div>
    </form>
  );
}
