import { ValidationError } from "@shared/domain/errors";

export const MAX_CSV_CHARS = 1_000_000;
export const MAX_CSV_DATA_LINES = 2000;
const TOO_BIG = "Arquivo grande demais (máx. 2.000 linhas).";

/** UTF-8 estrito (sem BOM); se os bytes não forem UTF-8 válido, windows-1252. */
export function decodeCsvBytes(bytes: Uint8Array): string {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    text = new TextDecoder("windows-1252").decode(bytes);
  }
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function detectSeparator(text: string): string {
  let inQuotes = false;
  let semi = 0;
  let line = "";
  // Primeira linha não vazia (fora de aspas).
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') inQuotes = !inQuotes;
    if (!inQuotes && (ch === "\n" || ch === "\r")) {
      if (line.replace(/[;,\s]/g, "") !== "") break;
      line = "";
      semi = 0;
      continue;
    }
    if (!inQuotes && ch === ";") semi++;
    line += ch;
  }
  return semi > 0 ? ";" : ",";
}

/**
 * Lê CSV (`;` ou `,`, aspas com `""`, quebras dentro de aspas). Linhas sem nenhuma
 * célula preenchida são ignoradas; `line` é a linha física (1 = cabeçalho) onde o registro começa.
 */
export function parseCsv(text: string): { header: string[]; rows: { line: number; cells: string[] }[] } {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  if (text.length > MAX_CSV_CHARS) throw new ValidationError(TOO_BIG, []);
  const sep = detectSeparator(text);

  const records: { line: number; cells: string[] }[] = [];
  let cells: string[] = [];
  let field = "";
  let quoted = false; // campo atual aberto com aspas
  let inQuotes = false;
  let fieldStarted = false; // já houve caractere não-espaço no campo
  let line = 1;
  let recordLine = 1;

  const endField = () => {
    cells.push(quoted ? field : field.trim());
    field = "";
    quoted = false;
    fieldStarted = false;
  };
  const endRecord = () => {
    endField();
    if (cells.some((c) => c.trim() !== "")) records.push({ line: recordLine, cells });
    cells = [];
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else {
        if (ch === "\n") line++;
        field += ch;
      }
      continue;
    }
    if (ch === '"' && !fieldStarted && field.trim() === "") {
      inQuotes = true;
      quoted = true;
      fieldStarted = true;
      field = "";
    } else if (ch === sep) {
      endField();
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      endRecord();
      line++;
      recordLine = line;
    } else {
      if (ch !== " " && ch !== "\t") fieldStarted = true;
      field += ch;
    }
  }
  if (field !== "" || cells.length > 0) endRecord();

  const [head, ...rows] = records;
  if (!head) return { header: [], rows: [] };
  if (rows.length > MAX_CSV_DATA_LINES) throw new ValidationError(TOO_BIG, []);
  return { header: head.cells, rows };
}
export { LEGACY_COLUMNS, mapHeader, type LegacyColumn } from "./legacyTemplate";
