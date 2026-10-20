import { CustomerForm } from './CustomerForm';
import { useUpdateCustomer } from '../hooks/useUpdateCustomer';
import type { ICustomer } from '../types';

interface Props {
  customer: ICustomer;
  onCancel: () => void;
  onSuccess: () => void;
}

export function CustomerEditForm({ customer, onCancel, onSuccess }: Props) {
  const { mutateAsync } = useUpdateCustomer(customer.id);

  async function handleSubmit(data: Parameters<typeof mutateAsync>[0]) {
    await mutateAsync(data);
    onSuccess();
  }

  return <CustomerForm key={customer.id} initialData={customer} onSubmit={handleSubmit} onCancel={onCancel} mode="edit" />;
}
