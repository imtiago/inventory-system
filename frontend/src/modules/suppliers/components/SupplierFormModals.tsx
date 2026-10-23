import { Modal } from '@/shared/components/Modal/Modal';
import { notify } from '@/shared/utils/notify';

import { SupplierForm } from './SupplierForm';
import { diffSupplier, toCreateDTO, type SupplierFormValues } from '../utils/diffSupplier';
import { useCreateSupplier, useUpdateSupplier } from '../hooks/useSupplierMutations';
import type { ISupplier } from '../types';

export function SupplierCreateModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { mutateAsync } = useCreateSupplier();

  async function handleSubmit(form: SupplierFormValues) {
    await mutateAsync(toCreateDTO(form));
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Cadastrar novo fornecedor" description="Informe os dados do fornecedor.">
      {open && <SupplierForm onSubmit={handleSubmit} onCancel={onClose} />}
    </Modal>
  );
}

function EditForm({ supplier, onClose }: { supplier: ISupplier; onClose: () => void }) {
  const { mutateAsync } = useUpdateSupplier(supplier.id);

  async function handleSubmit(form: SupplierFormValues) {
    const changes = diffSupplier(supplier, form);

    if (Object.keys(changes).length === 0) {
      notify.info('Nenhuma alteração para salvar.');
      return;
    }

    await mutateAsync(changes);
    onClose();
  }

  return <SupplierForm mode="edit" initialData={supplier} onSubmit={handleSubmit} onCancel={onClose} />;
}

/** null = closed. */
export function SupplierEditModal({ supplier, onClose }: { supplier: ISupplier | null; onClose: () => void }) {
  return (
    <Modal open={supplier !== null} onClose={onClose} title="Editar fornecedor" description="Atualize os dados do fornecedor.">
      {supplier && <EditForm key={supplier.id} supplier={supplier} onClose={onClose} />}
    </Modal>
  );
}
