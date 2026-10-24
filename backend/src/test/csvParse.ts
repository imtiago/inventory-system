/** Lê um CSV do sistema (BOM, ";", CRLF, aspas) em matriz de strings, para os testes. */
export function parseCsv(text: string): string[][] {
  const body = text.startsWith("﻿") ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (quoted) {
      if (ch === '"' && body[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ";") {
      row.push(cell);
      cell = "";
    } else if (ch === "\r" && body[i + 1] === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      i++;
    } else cell += ch;
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}
