import { useState } from 'react';
import { Link } from 'react-router-dom';
import { TriangleAlert } from 'lucide-react';

import { Section } from '@/shared/components/details/Section';
import { parseApiErrorSync } from '@/shared/services/parseApiError';
import { formatDateTime } from '@/shared/utils/formatDateTime';

import { useSaveCreditSettings } from '../hooks/useCredit';
import type { CreditSettings } from '../types';

/** Mensagens extras por código de erro da ativação (a API já manda o texto principal em PT). */
const ACTIVATION_HINTS: Record<string, { text: string; to: string }> = {
  STORE_SETTINGS_MISSING: { text: 'Preencha os dados da loja', to: '/settings/store' },
};

export function CrediarioSwitch({ settings }: { settings: CreditSettings }) {
  const save = useSaveCreditSettings();
  const [error, setError] = useState<{ message: string; hint?: { text: string; to: string } } | null>(null);
  const enabled = settings.crediarioEnabled;

  async function toggle() {
    setError(null);

    try {
      await save.mutateAsync({ crediarioEnabled: !enabled });
    } catch (e) {
      const { code, message } = parseApiErrorSync(e);
      setError({ message, hint: ACTIVATION_HINTS[code] });
    }
  }

  return (
    <Section title="Crediário" description="Venda parcelada pela loja, com limite por cliente.">
      <div className="flex flex-col gap-4 p-4 sm:p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <span id="crediario-switch-label" className="font-medium">
              Crediário ativo
            </span>
            <p id="crediario-switch-state" className="text-sm text-muted">
              {enabled ? `Ativo${settings.enabledAt ? ` desde ${formatDateTime(settings.enabledAt)}` : ''}${settings.enabledBy ? ` por ${settings.enabledBy.name}` : ''}.` : 'Desligado: as vendas no crediário ainda não são aceitas.'}
            </p>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-labelledby="crediario-switch-label"
            aria-describedby="crediario-switch-state"
            disabled={save.isPending}
            onClick={toggle}
            className={`relative inline-flex h-11 w-16 shrink-0 items-center rounded-full border-2 transition-colors disabled:opacity-50 ${enabled ? 'border-primary bg-primary' : 'border-foreground/50 bg-surface-muted'}`}
          >
            <span aria-hidden="true" className={`inline-block h-7 w-7 rounded-full shadow transition-transform ${enabled ? 'translate-x-7 bg-primary-foreground' : 'translate-x-1 bg-foreground/60'}`} />
          </button>
        </div>

        {!enabled && (
          <div className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning-soft p-3 text-sm text-warning">
            <TriangleAlert size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
            <p>Confira os valores antes de ativar</p>
          </div>
        )}

        {error && (
          <div role="alert" className="rounded-lg border border-danger/30 bg-danger-soft p-3 text-sm text-danger">
            <p>{error.message}</p>
            {error.hint && (
              <p className="mt-1 font-medium">
                <Link to={error.hint.to} className="underline underline-offset-2">
                  {error.hint.text}
                </Link>
              </p>
            )}
          </div>
        )}
      </div>
    </Section>
  );
}
