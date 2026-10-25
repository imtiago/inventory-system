// CSV para Excel em português: UTF-8 com BOM, ";" como separador, CRLF, decimal com vírgula.

const BOM = "﻿";
const FORMULA_START = /^[=+\-@\t\r]/;

/** Célula já formatada pelo sistema (número/data): não sofre neutralização de fórmula. */
export class CsvRaw {
  constructor(readonly text: string) {}
}

export type CsvCell = string | number | null | CsvRaw;

function escapeText(value: string): string {
  const safe = FORMULA_START.test(value) ? `'${value}` : value;
  return /[;"\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

function cellText(cell: CsvCell): string {
  if (cell === null) return "";
  if (cell instanceof CsvRaw) return cell.text;
  if (typeof cell === "number") return String(cell).replace(".", ",");
  return escapeText(cell);
}

/** Monta o CSV (cabeçalho + linhas). Campos de texto são protegidos contra injeção de fórmula. */
export function toCsv(headers: string[], rows: CsvCell[][]): string {
  const lines = [headers, ...rows].map((row, i) =>
    row.map((c) => (i === 0 ? escapeText(String(c)) : cellText(c))).join(";"),
  );
  return BOM + lines.join("\r\n") + "\r\n";
}

/** Centavos (number inteiro) → "1234,50". */
export function formatCentsBr(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(Math.round(cents));
  return `${sign}${Math.floor(abs / 100)},${String(abs % 100).padStart(2, "0")}`;
}

/** Decimal em string ("1234.5") → "1234,50". */
export function formatMoneyBr(value: string): string {
  const m = /^(-?)(\d+)(?:\.(\d*))?$/.exec(value.trim());
  if (!m) throw new RangeError(`Valor monetário inválido: ${value}`);
  const frac = (m[3] ?? "").padEnd(2, "0");
  if (frac.length > 2 && /[1-9]/.test(frac.slice(2))) {
    // Arredonda meio para cima em aritmética de string (via centavos).
    const cents = BigInt(m[2] + frac.slice(0, 2)) + (frac.charCodeAt(2) >= 53 ? 1n : 0n);
    const s = cents.toString().padStart(3, "0");
    return `${m[1]}${s.slice(0, -2)},${s.slice(-2)}`;
  }
  return `${m[1]}${m[2]},${frac.slice(0, 2)}`;
}

/** Quantidade (inteira ou decimal) com vírgula, sem separador de milhar. */
export function formatQuantityBr(value: number | string): string {
  return String(value).replace(".", ",");
}

/** "YYYY-MM-DD" → "dd/mm/aaaa". */
export function formatDateBr(day: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(day);
  if (!m) throw new RangeError(`Data inválida: ${day}`);
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export const csvMoney = (v: string) => new CsvRaw(formatMoneyBr(v));
export const csvCents = (v: number) => new CsvRaw(formatCentsBr(v));
export const csvQty = (v: number | string) => new CsvRaw(formatQuantityBr(v));
export const csvDate = (v: string) => new CsvRaw(formatDateBr(v));

/** Cabeçalhos do download (nome do relatório + data de negócio de hoje). */
export function csvHeaders(name: string, today: string) {
  return {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${name}-${today}.csv"`,
  };
}
