import { ValidationError } from "@shared/domain/errors";

export const LEGACY_COLUMNS = [
  "nome",
  "celular",
  "data_compra",
  "descricao",
  "valor_total",
  "valor_pago",
  "vencimentos",
  "perfil",
  "observacao",
] as const;

export type LegacyColumn = (typeof LEGACY_COLUMNS)[number];

const REQUIRED: readonly LegacyColumn[] = ["nome", "valor_total"];

function normalizeHeaderCell(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, "_");
}

/** Índice de cada coluna conhecida no cabeçalho (null = ausente). */
export function mapHeader(header: string[]): Record<LegacyColumn, number | null> {
  const normalized = header.map(normalizeHeaderCell);
  const map = {} as Record<LegacyColumn, number | null>;
  for (const col of LEGACY_COLUMNS) {
    const idx = normalized.indexOf(col);
    map[col] = idx === -1 ? null : idx;
  }
  for (const col of REQUIRED) {
    if (map[col] === null) throw new ValidationError(`Coluna obrigatória ausente: ${col}`, []);
  }
  return map;
}

/** Modelo para download: BOM (abre certo no Excel), `;` e CRLF. */
export function buildLegacyTemplateCsv(): string {
  const rows = [
    [...LEGACY_COLUMNS],
    ["Maria Silva", "(11) 98888-7777", "05/03/2026", "Sofá", "1.200,00", "200,00", "10/11/2026=500,00; 10/12/2026=500,00", "Regular", "Paga em mãos"],
    ["João Souza", "", "", "Fogão", "850,00", "", "", "", ""],
  ];
  const cell = (c: string) => (/[;"\r\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c);
  return "﻿" + rows.map((r) => r.map(cell).join(";")).join("\r\n") + "\r\n";
}
