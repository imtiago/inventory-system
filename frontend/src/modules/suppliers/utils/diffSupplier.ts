import type { ICreateSupplierDTO, ISupplier, UpdateSupplierInput } from '../types';

const digits = (value: string | null | undefined) => (value ?? '').replace(/\D/g, '');

export interface SupplierFormValues {
  name: string;
  document: string;
  email: string;
  phone: string;
}

/** Only the fields that differ from the stored supplier; emptied optional fields become null (clear). */
export function diffSupplier(supplier: ISupplier, form: SupplierFormValues): UpdateSupplierInput {
  const changes: UpdateSupplierInput = {};
  const name = form.name.trim();
  const email = form.email.trim().toLowerCase();

  if (name !== supplier.name) changes.name = name;
  if (digits(form.document) !== supplier.document) changes.document = digits(form.document);
  if ((email || null) !== (supplier.email ?? null)) changes.email = email || null;
  if ((digits(form.phone) || null) !== (supplier.phone ?? null)) changes.phone = digits(form.phone) || null;

  return changes;
}

export function toCreateDTO(form: SupplierFormValues): ICreateSupplierDTO {
  const dto: ICreateSupplierDTO = { name: form.name.trim(), document: digits(form.document) };

  if (form.email.trim()) dto.email = form.email.trim().toLowerCase();
  if (digits(form.phone)) dto.phone = digits(form.phone);

  return dto;
}
