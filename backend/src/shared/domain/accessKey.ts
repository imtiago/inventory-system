/** Chave de acesso da NF-e (44 dígitos): dígito verificador módulo 11. */

/** DV de 43 dígitos: pesos 2..9 da direita para a esquerda; resto 0 ou 1 → 0. */
export function accessKeyCheckDigit(base43: string): number {
  if (!/^\d{43}$/.test(base43)) throw new RangeError("A base da chave de acesso deve ter 43 dígitos.");
  let sum = 0;
  let weight = 2;
  for (let i = base43.length - 1; i >= 0; i--) {
    sum += Number(base43[i]) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  const rest = sum % 11;
  return rest < 2 ? 0 : 11 - rest;
}

/** 44 dígitos com DV correto. */
export function isValidAccessKey(key: string): boolean {
  if (!/^\d{44}$/.test(key)) return false;
  return accessKeyCheckDigit(key.slice(0, 43)) === Number(key[43]);
}
