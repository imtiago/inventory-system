/**
 * Chave de acesso da NF-e (44 posições): dígito verificador módulo 11.
 * Com CNPJ alfanumérico (NT 2025.001) as posições 7–18 (CNPJ sem os DVs) podem
 * ter [0-9A-Z]; o valor de cada caractere no cálculo é código ASCII − 48.
 */

const BASE_PATTERN = /^\d{6}[0-9A-Z]{12}\d{25}$/;
const KEY_PATTERN = /^\d{6}[0-9A-Z]{12}\d{26}$/;

/** DV das 43 primeiras posições: pesos 2..9 da direita para a esquerda; resto 0 ou 1 → 0. */
export function accessKeyCheckDigit(base43: string): number {
  if (!BASE_PATTERN.test(base43)) throw new RangeError("Base da chave de acesso inválida (43 posições).");
  let sum = 0;
  let weight = 2;
  for (let i = base43.length - 1; i >= 0; i--) {
    sum += (base43.charCodeAt(i) - 48) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  const rest = sum % 11;
  return rest < 2 ? 0 : 11 - rest;
}

/** 44 posições no formato da chave, com DV correto. */
export function isValidAccessKey(key: string): boolean {
  if (!KEY_PATTERN.test(key)) return false;
  return accessKeyCheckDigit(key.slice(0, 43)) === Number(key[43]);
}
