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
