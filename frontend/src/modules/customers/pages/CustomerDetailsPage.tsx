import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Mail, MapPin, Phone, Pencil, UserRound } from 'lucide-react';

import { Page } from '@/shared/components/layout/Page';
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
      <Page>
        <div className="p-6 text-sm text-muted">Carregando dados do cliente...</div>
      </Page>
    );
  }

  if (isError || !customer) {
    return (
      <Page>
        <div className="space-y-4 p-6">
          <p className="text-sm text-danger">Não foi possível carregar os dados do cliente.</p>

          <Link to="/customers" className="inline-flex items-center gap-2 text-sm text-muted hover:text-foreground">
            <ArrowLeft size={18} />
            Voltar para clientes
          </Link>
        </div>
      </Page>
    );
  }

  return (
    <Page>
      <div className="mx-auto flex h-full min-h-0 w-full max-w-5xl flex-col gap-6 p-4 sm:p-6">
        {/* Voltar para a listagem */}
        <Link to="/customers" className="inline-flex w-fit items-center gap-2 text-sm text-muted transition hover:text-foreground">
          <ArrowLeft size={18} />
          Voltar para clientes
        </Link>

        {/* Cabeçalho e informações */}
        <Section title="Informações do cliente" description="Dados cadastrais e informações de contato" className="shrink-0">
          <div className="space-y-6 p-6">
            {/* Identificação do cliente */}
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div className="flex min-w-0 items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-surface-muted">
                  <UserRound size={28} className="text-muted" />
                </div>

                <div className="min-w-0">
                  <h1 className="break-words text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{customer.name}</h1>

                  <p className="mt-1 text-sm text-muted">Cliente #{customer.id.slice(0, 8).toUpperCase()}</p>
                </div>
              </div>

              <Can permission="customers.write">
                <Button type="button" className="shrink-0 border border-input bg-surface text-foreground hover:bg-surface-muted" onClick={() => setEditing(true)}>
                  <Pencil size={16} className="mr-2" />
                  Editar
                </Button>
              </Can>
            </div>

            <div className="border-t border-border" />

            {/* Dados de contato */}
            <div className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2">
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
          </div>
        </Section>
      </div>

      <CustomerEditModal customer={editing ? customer : null} onClose={() => setEditing(false)} />
    </Page>
  );
}
