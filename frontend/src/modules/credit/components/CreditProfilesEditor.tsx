import { useForm } from 'react-hook-form';

import { LoadingState } from '@/shared/components/LoadingState';
import { formatMoneyInput, moneyTextError, parseMoneyToCents } from '@/shared/utils/money';
import { formatPercentInput, parsePercentToBps } from '@/shared/utils/percent';
import { parseApiErrorSync } from '@/shared/services/parseApiError';

import { useCreditProfiles, useUpdateCreditProfile } from '../hooks/useCredit';
import type { CreditProfile } from '../types';
import { intError, MAX_INSTALLMENTS, parseIntText, percentRangeError } from '../utils/rulesForm';
import { CreditField } from './CreditField';

interface FormValues {
  initialLimit: string;
  minDownPayment: string;
  maxInstallments: string;
}

const toValues = (p: CreditProfile): FormValues => ({
  initialLimit: formatMoneyInput(p.initialLimit),
  minDownPayment: formatPercentInput(p.minDownPaymentPercent),
  maxInstallments: String(p.maxInstallments),
});

function ProfileCard({ profile }: { profile: CreditProfile }) {
  const save = useUpdateCreditProfile();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ defaultValues: toValues(profile), values: toValues(profile) });
  const prefix = `credit-profile-${profile.code}`;

  const submit = handleSubmit(async (values) => {
    try {
      await save.mutateAsync({
        code: profile.code,
        input: {
          initialLimit: (parseMoneyToCents(values.initialLimit) ?? 0) / 100,
          minDownPaymentPercent: (parsePercentToBps(values.minDownPayment) as { bps: number }).bps / 100,
          maxInstallments: parseIntText(values.maxInstallments) ?? 0,
        },
      });
    } catch (error) {
      setError('root.server', { type: 'server', message: parseApiErrorSync(error).message });
    }
  });

  // O nome acessível leva o perfil ("Novo: Limite inicial (R$)"); o texto visível já está dentro dele.
  const named = (text: string) => ({ label: text, ariaLabel: `${profile.name}: ${text}` });

  return (
    <form onSubmit={submit} noValidate aria-labelledby={`${prefix}-title`} className="flex min-w-0 flex-col gap-4 rounded-xl border border-border bg-surface p-4">
      <h3 id={`${prefix}-title`} className="text-base font-semibold">
        {profile.name}
      </h3>

      {errors.root?.server && (
        <p role="alert" className="rounded-lg border border-danger/30 bg-danger-soft p-3 text-sm text-danger">
          {errors.root.server.message}
        </p>
      )}

      <CreditField id={`${prefix}-limit`} {...named('Limite inicial (R$)')} kind="money" registration={register('initialLimit', { validate: (v) => moneyTextError(v) ?? true })} error={errors.initialLimit?.message} />
      <CreditField
        id={`${prefix}-down`}
        {...named('Entrada mínima (%)')}
        kind="percent"
        registration={register('minDownPayment', { validate: (v) => percentRangeError(v, 10000, 'O máximo é 100%') ?? true })}
        error={errors.minDownPayment?.message}
      />
      <CreditField
        id={`${prefix}-installments`}
        {...named('Máximo de parcelas')}
        kind="int"
        registration={register('maxInstallments', { validate: (v) => intError(v, { min: 1, max: MAX_INSTALLMENTS }) ?? true })}
        error={errors.maxInstallments?.message}
      />

      <button type="submit" disabled={isSubmitting} aria-label={`Salvar perfil ${profile.name}`} className="min-h-11 w-full rounded-lg border border-input bg-surface px-4 font-medium text-foreground hover:bg-surface-muted disabled:opacity-50">
        {isSubmitting ? 'Salvando...' : 'Salvar'}
        
      </button>
    </form>
  );
}

/** Perfis de cliente: limite inicial, entrada mínima e máximo de parcelas, um cartão por perfil. */
export function CreditProfilesEditor() {
  const { data: profiles, isLoading, isError } = useCreditProfiles();

  if (isLoading) return <LoadingState label="Carregando perfis..." />;
  if (isError || !profiles) {
    return (
      <p role="alert" className="m-4 rounded-xl border border-danger/30 bg-danger-soft p-4 text-sm text-danger sm:m-6">
        Não foi possível carregar os perfis.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 p-4 sm:p-6 md:grid-cols-2 xl:grid-cols-4">
      {profiles.map((profile) => (
        <ProfileCard key={profile.code} profile={profile} />
      ))}
    </div>
  );
}
