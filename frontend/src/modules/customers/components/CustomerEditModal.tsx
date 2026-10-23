import { Modal } from '@/shared/components/Modal/Modal';
import { notify } from '@/shared/utils/notify';

import { CustomerForm } from './CustomerForm';
import { useUpdateCustomer } from '../hooks/useUpdateCustomer';
import type { ICreateCustomerDTO, ICustomer, UpdateCustomerInput } from '../types';

const digits = (value: string | null | undefined) => (value ?? '').replace(/\D/g, '');

/** Only the fields that differ from the stored customer; empty optional fields become null (clear). */
export function diffCustomer(customer: ICustomer, form: ICreateCustomerDTO): UpdateCustomerInput {
  const changes: UpdateCustomerInput = {};
  const name = form.name.trim();

  if (name !== customer.name) changes.name = name;
  if ((form.email ?? null) !== (customer.email ?? null)) changes.email = form.email ?? null;
  if (digits(form.phone) !== digits(customer.phone)) changes.phone = digits(form.phone) || null;
  if ((form.address ?? null) !== (customer.address ?? null)) changes.address = form.address ?? null;

  return changes;
}

interface Props {
  /** null = closed. */
  customer: ICustomer | null;
  onClose: () => void;
}

function EditForm({ customer, onClose }: { customer: ICustomer; onClose: () => void }) {
  const { mutateAsync } = useUpdateCustomer(customer.id);

  async function handleSubmit(form: ICreateCustomerDTO) {
    const changes = diffCustomer(customer, form);

    if (Object.keys(changes).length === 0) {
      notify.info('Nenhuma alteração para salvar.');
      return;
    }

    await mutateAsync(changes);
    onClose();
  }

  return <CustomerForm initialData={customer} onSubmit={handleSubmit} onCancel={onClose} mode="edit" />;
}

/** Edit-customer modal shared by the list and the details page. */
export function CustomerEditModal({ customer, onClose }: Props) {
  return (
    <Modal open={customer !== null} onClose={onClose} title="Editar cliente" description="Atualize os dados do cliente.">
      {customer && <EditForm key={customer.id} customer={customer} onClose={onClose} />}
    </Modal>
  );
}
