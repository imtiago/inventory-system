/** CPF/CNPJ: normalização e validação dos dígitos verificadores. */

export type DocumentType = "CPF" | "CNPJ";

export function normalizeDocument(input: string): string {
  return input.replace(/\D/g, "");
}

const allSameDigit = (digits: string) => /^(\d)\1+$/.test(digits);

function checkDigit(digits: number[], weights: number[]): number {
  const sum = digits.reduce((acc, d, i) => acc + d * weights[i], 0);
  const rest = sum % 11;
  return rest < 2 ? 0 : 11 - rest;
}

export function isValidCpf(input: string): boolean {
  const digits = normalizeDocument(input);
  if (digits.length !== 11 || allSameDigit(digits)) return false;
  const nums = [...digits].map(Number);
  const d1 = checkDigit(nums.slice(0, 9), [10, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = checkDigit(nums.slice(0, 10), [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
  return nums[9] === d1 && nums[10] === d2;
}

export function isValidCnpj(input: string): boolean {
  const digits = normalizeDocument(input);
  if (digits.length !== 14 || allSameDigit(digits)) return false;
  const nums = [...digits].map(Number);
  const d1 = checkDigit(nums.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = checkDigit(nums.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return nums[12] === d1 && nums[13] === d2;
}

/** Tipo derivado do documento (só dígitos); null se não for um CPF/CNPJ válido. */
export function documentTypeOf(digits: string): DocumentType | null {
  if (isValidCpf(digits)) return "CPF";
  if (isValidCnpj(digits)) return "CNPJ";
  return null;
}
