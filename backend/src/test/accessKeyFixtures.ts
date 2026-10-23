// Chaves de acesso de NF-e aleatórias com DV válido: testes paralelos precisam de chave única.
import { accessKeyCheckDigit } from "@shared/domain/accessKey";
import { randomCnpj } from "./documentFixtures";

const digits = (n: number) => Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join("");

/**
 * Chave de 44 dígitos (modelo 55, SP, emissão normal) com DV válido.
 * `cnpj` (14 posições, numérico ou alfanumérico) fixa o emitente; senão um CNPJ válido aleatório.
 */
export function buildAccessKey(opts: { cnpj?: string; series?: number; number?: number } = {}): string {
  const cnpj = opts.cnpj ?? randomCnpj();
  if (!/^[0-9A-Z]{12}\d{2}$/.test(cnpj)) throw new RangeError("cnpj deve ter 14 posições.");
  const series = String(opts.series ?? 1).padStart(3, "0");
  const number = opts.number !== undefined ? String(opts.number).padStart(9, "0") : digits(9);
  const base = `352610${cnpj}55${series}${number}1${digits(8)}`;
  return base + accessKeyCheckDigit(base);
}
