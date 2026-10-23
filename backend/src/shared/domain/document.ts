/**
 * CPF/CNPJ: normalização e validação dos dígitos verificadores.
 * CNPJ pode ser alfanumérico (IN RFB 2.229/2024): 12 posições [0-9A-Z] + 2 DVs
 * numéricos, com valor de cada caractere = código ASCII − 48 (dígitos mantêm o valor).
 */

export type DocumentType = "CPF" | "CNPJ";

/** Remove máscara (tudo que não é [0-9A-Z]) e passa para maiúsculas. */
export function normalizeDocument(input: string): string {
  return input.toUpperCase().replace(/[^0-9A-Z]/g, "");
}

const allSameChar = (value: string) => /^(.)\1+$/.test(value);

const charValue = (c: string) => c.charCodeAt(0) - 48;

function checkDigit(chars: string, weights: number[]): number {
  const sum = [...chars].reduce((acc, c, i) => acc + charValue(c) * weights[i], 0);
  const rest = sum % 11;
  return rest < 2 ? 0 : 11 - rest;
}

export function isValidCpf(input: string): boolean {
  const digits = normalizeDocument(input);
  if (!/^\d{11}$/.test(digits) || allSameChar(digits)) return false;
  const d1 = checkDigit(digits.slice(0, 9), [10, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = checkDigit(digits.slice(0, 10), [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
  return Number(digits[9]) === d1 && Number(digits[10]) === d2;
}

/** CNPJ numérico ou alfanumérico (com ou sem máscara, maiúsculas ou minúsculas). */
export function isValidCnpj(input: string): boolean {
  const value = normalizeDocument(input);
  if (!/^[0-9A-Z]{12}\d{2}$/.test(value) || allSameChar(value)) return false;
  const d1 = checkDigit(value.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = checkDigit(value.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return Number(value[12]) === d1 && Number(value[13]) === d2;
}

/** Tipo derivado do documento normalizado; null se não for um CPF/CNPJ válido. */
export function documentTypeOf(document: string): DocumentType | null {
  if (isValidCpf(document)) return "CPF";
  if (isValidCnpj(document)) return "CNPJ";
  return null;
}
