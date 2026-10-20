import { useState } from 'react';

import { CrudHeader, CrudPagination } from '@/shared/components/crud';

import { DataTable } from '@/shared/components/table';

import { useCustomers } from '../hooks/useCustomers.ts';
import { useCustomerColumns } from '../hooks/useCustomerColumns.tsx';
import { Section } from '@/shared/components/details/Section';
import { Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Page } from '@/shared/components/layout/Page';
import { Modal } from '@/shared/components/Modal/Modal.tsx';
import { Button } from '@/components/ui/button.tsx';
import { CustomerForm } from '../components/CustomerForm.tsx';
import { useCreateCustomer } from '../hooks/useCreateCustomer.ts';
import type { ICreateCustomerDTO, ICustomer } from '../types';
import { CustomerEditForm } from '../components/CustomerEditForm';

const modalConfig = {
  'new-customer': {
    title: 'Cadastrar novo cliente',
    subtitle: 'Informe os dados do cliente.',
  },

  'edit-customer': {
    title: 'Editar cliente',
    subtitle: 'Atualize os dados do cliente.',
  },
};

type ModalStep = 'list' | keyof typeof modalConfig;

export function CustomerListPage() {
  const [page, setPage] = useState(1);
  const [step, setStep] = useState<ModalStep>('list');
  const [selectedCustomer, setSelectedCustomer] = useState<ICustomer | null>(null);

  const currentModal = step !== 'list' ? modalConfig[step] : null;

  const columns = useCustomerColumns((customer) => {
    setSelectedCustomer(customer);
    setStep('edit-customer');
  });

  const { data, isLoading, isFetching } = useCustomers(page);
  const { mutateAsync } = useCreateCustomer();

  async function handleSubmitCreateCustomer(formData: ICreateCustomerDTO) {
    await mutateAsync(formData);
    setStep('list');
  }
  return (
    <Page>
      {/* <CrudHeader
        title="Produtos"
        description="Gerencie seu catálogo"
        createPath="/products/new"
        createLabel="Novo Produto"
        loading={isFetching}
      /> */}

      <Section
        title={`Clientes (${data?.pagination.total})`}
        // description="Unidades comercializadas deste produto"
        actions={
          <Button
            onClick={() => {
              setSelectedCustomer(null);
              setStep('new-customer');
            }}
            className="flex items-center gap-2 rounded-lg bg-black px-4 py-2 text-white"
          >
            <Plus size={18} />
            Novo Cliente
          </Button>
        }
      >
        {' '}
        {/* Área da tabela */}
        <div className="flex-1 overflow-y-auto">
          <DataTable data={data?.data ?? []} columns={columns} getRowId={(item) => item.id} />
        </div>
        {/* Paginação fixa */}
        <CrudPagination
          page={data?.pagination.page ?? 1}
          totalPages={data?.pagination.totalPages ?? 1}
          totalItems={data?.pagination.total ?? 0}
          onPrevious={() => setPage((p) => Math.max(1, p - 1))}
          onNext={() => setPage((p) => Math.min(data?.pagination.totalPages ?? 1, p + 1))}
        />
      </Section>
      <Modal
        open={currentModal !== null}
        onClose={() => {
          setStep('list');
          setSelectedCustomer(null);
        }}
        title={currentModal?.title ?? ''}
        description={currentModal?.subtitle}
      >
        {step === 'new-customer' && <CustomerForm onCancel={() => setStep('list')} onSubmit={handleSubmitCreateCustomer} />}

        {step === 'edit-customer' && selectedCustomer && (
          <CustomerEditForm
            key={selectedCustomer.id}
            customer={selectedCustomer}
            onCancel={() => {
              setStep('list');
              setSelectedCustomer(null);
            }}
            onSuccess={() => {
              setStep('list');
              setSelectedCustomer(null);
            }}
          />
        )}
      </Modal>
    </Page>
  );
}
