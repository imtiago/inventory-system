import { Modal } from '@/shared/components/Modal/Modal';
import { useModalBusy } from '@/shared/components/Modal/useModalBusy';
import { notify } from '@/shared/utils/notify';

import { CustomerForm } from './CustomerForm';
import { diffCustomer } from '../utils/diffCustomer';
import { useUpdateCustomer } from '../hooks/useUpdateCustomer';
import type { ICreateCustomerDTO, ICustomer } from '../types';

interface Props {
  /** null = closed. */
  customer: ICustomer | null;
  onClose: () => void;
}

function EditForm({ customer, onClose }: { customer: ICustomer; onClose: () => void }) {
  const { mutateAsync, isPending } = useUpdateCustomer(customer.id);
  useModalBusy(isPending);

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
