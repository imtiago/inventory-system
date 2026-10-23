/**
 * Document characters as typed: uppercase [0-9A-Z] only, max 14. The alphanumeric CNPJ (12 alphanumeric + 2 digits)
 * is accepted as the backend does; a CPF is always numeric.
 */
export function normalizeDocument(value: string | null | undefined): string {
  return (value ?? '').toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 14);
}

/** CPF (11 digits) or CNPJ (12 alphanumeric + 2 check digits). */
export function isValidDocumentFormat(value: string | null | undefined): boolean {
  const document = normalizeDocument(value);

  return /^\d{11}$/.test(document) || /^[0-9A-Z]{12}\d{2}$/.test(document);
}

/** Progressive CPF mask (numeric, up to 11) or CNPJ mask XX.XXX.XXX/XXXX-XX (letters or more than 11 characters). */
export function maskDocument(value: string | null | undefined): string {
  const chars = normalizeDocument(value);

  if (/^\d{0,11}$/.test(chars)) {
    return chars
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4');
  }

  return chars
    .replace(/^([0-9A-Z]{2})([0-9A-Z])/, '$1.$2')
    .replace(/^([0-9A-Z]{2})\.([0-9A-Z]{3})([0-9A-Z])/, '$1.$2.$3')
    .replace(/^([0-9A-Z]{2})\.([0-9A-Z]{3})\.([0-9A-Z]{3})([0-9A-Z])/, '$1.$2.$3/$4')
    .replace(/^([0-9A-Z]{2})\.([0-9A-Z]{3})\.([0-9A-Z]{3})\/([0-9A-Z]{4})([0-9A-Z])/, '$1.$2.$3/$4-$5');
}

export function maskSupplierPhone(value: string | null | undefined): string {
  const digits = (value ?? '').replace(/\D/g, '').slice(0, 11);

  if (digits.length === 0) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;

  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}
