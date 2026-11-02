import { Section } from '@/shared/components/details/Section';
import { LoadingState } from '@/shared/components/LoadingState';
import { Page } from '@/shared/components/layout/Page';
import { PageHeader } from '@/shared/components/layout/PageHeader';

import { CrediarioSwitch } from '../components/CrediarioSwitch';
import { CreditProfilesEditor } from '../components/CreditProfilesEditor';
import { CreditRulesForm } from '../components/CreditRulesForm';
import { useCreditSettings } from '../hooks/useCredit';

export function CreditSettingsPage() {
  const { data: settings, isLoading, isError } = useCreditSettings();

  return (
    <Page width="narrow">
      <PageHeader title="Configurações de crédito" description="Regras do crediário, perfis de cliente e ativação." />

      {isLoading ? (
        <LoadingState label="Carregando configurações..." />
      ) : isError || !settings ? (
        <p role="alert" className="rounded-xl border border-danger/30 bg-danger-soft p-4 text-sm text-danger">
          Não foi possível carregar as configurações de crédito.
        </p>
      ) : (
        <>
          <CrediarioSwitch settings={settings} />
          <CreditRulesForm settings={settings} />
          <Section title="Perfis de cliente" description="Limite inicial, entrada mínima e parcelas de cada perfil.">
            <CreditProfilesEditor />
          </Section>
        </>
      )}
    </Page>
  );
}
