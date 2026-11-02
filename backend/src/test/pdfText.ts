import { inflateSync } from "node:zlib";

/** Número de páginas de um PDF do pdfkit (objetos `/Type /Page`, sem `/Pages`). */
export function pdfPageCount(pdf: Buffer): number {
  return (pdf.toString("latin1").match(/\/Type \/Page(?!s)/g) ?? []).length;
}

/**
 * Texto de um PDF do pdfkit com fontes padrão: descomprime os streams e junta as strings hex dos
 * operadores de texto (WinAnsi ≈ latin1). Cada página vira um item; só serve para conferir conteúdo.
 */
export function pdfPages(pdf: Buffer): string[] {
  const raw = pdf.toString("latin1");
  const pages: string[] = [];
  const streamRe = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  for (let m = streamRe.exec(raw); m; m = streamRe.exec(raw)) {
    let content: string;
    try {
      content = inflateSync(Buffer.from(m[1], "latin1")).toString("latin1");
    } catch {
      continue;
    }
    if (!content.includes(" TJ") && !content.includes(" Tj")) continue;
    let text = "";
    for (const hex of content.matchAll(/<([0-9a-fA-F]+)>/g)) text += Buffer.from(hex[1], "hex").toString("latin1");
    pages.push(text);
  }
  return pages;
}
