import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Mail, MapPin, Phone, Pencil } from 'lucide-react';

import { Page } from '@/shared/components/layout/Page';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { Section } from '@/shared/components/details/Section';
import { Button } from '@/components/ui/button';

import { useCustomer } from '../hooks/useCustomer';
import { Can } from '@/shared/auth/Can';
import { CustomerEditModal } from '../components/CustomerEditModal';
import { formatPhone } from '@/shared/utils/formatPhone';

export function CustomerDetailsPage() {
  const { id } = useParams<{ id: string }>();

  const [editing, setEditing] = useState(false);

  const { data: customer, isLoading, isError } = useCustomer(id ?? '');

  if (isLoading) {
    return (
      <Page width="narrow">
        <PageHeader title="Cliente" backPath="/customers" backLabel="clientes" />
        <div className="text-sm text-muted">Carregando dados do cliente...</div>
      </Page>
    );
  }

  if (isError || !customer) {
    return (
      <Page width="narrow">
        <PageHeader title="Cliente" backPath="/customers" backLabel="clientes" />
        <p className="text-sm text-danger">Não foi possível carregar os dados do cliente.</p>
      </Page>
    );
  }

  return (
    <Page width="narrow">
      <PageHeader
        title={customer.name}
        description={`Cliente #${customer.id.slice(0, 8).toUpperCase()}`}
        backPath="/customers"
        backLabel="clientes"
        actions={
          <Can permission="customers.write">
            <Button type="button" className="shrink-0 border border-input bg-surface text-foreground hover:bg-surface-muted" onClick={() => setEditing(true)}>
              <Pencil size={16} className="mr-2" />
              Editar
            </Button>
          </Can>
        }
      />

      <Section title="Informações do cliente" description="Dados cadastrais e informações de contato">
        <div className="grid grid-cols-1 gap-x-8 gap-y-6 p-4 sm:grid-cols-2 sm:p-6">
          <div className="flex min-w-0 items-start gap-3">
            <Mail size={19} className="mt-0.5 shrink-0 text-subtle" />

            <div className="min-w-0">
              <p className="text-sm text-muted">E-mail</p>

              <p className="mt-1 break-words font-medium text-foreground">{customer.email || 'Não informado'}</p>
            </div>
          </div>

          <div className="flex min-w-0 items-start gap-3">
            <Phone size={19} className="mt-0.5 shrink-0 text-subtle" />

            <div className="min-w-0">
              <p className="text-sm text-muted">Telefone</p>

              <p className="mt-1 font-medium text-foreground">{formatPhone(customer.phone)}</p>
            </div>
          </div>

          <div className="flex min-w-0 items-start gap-3 sm:col-span-2">
            <MapPin size={19} className="mt-0.5 shrink-0 text-subtle" />

            <div className="min-w-0">
              <p className="text-sm text-muted">Endereço</p>

              <p className="mt-1 break-words font-medium leading-relaxed text-foreground">{customer.address || 'Não informado'}</p>
            </div>
          </div>
        </div>
      </Section>

      <CustomerEditModal customer={editing ? customer : null} onClose={() => setEditing(false)} />
    </Page>
  );
}
