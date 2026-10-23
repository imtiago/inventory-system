import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { randomCnpj } from "../../../../../test/documentFixtures";
import { buildAccessKey } from "../../../../../test/accessKeyFixtures";

/** Helpers dos testes HTTP de /nfe-imports (não é um arquivo de teste). */

export const xmlFixture = (name: string) =>
  readFileSync(fileURLToPath(new URL(`../../../__fixtures__/${name}`, import.meta.url)), "utf-8");

// Valores fixos de nfe-completa.xml, trocados por aleatórios em cada nota de teste
// (testes paralelos: chave, CNPJ e códigos de barras únicos).
const TEMPLATE_KEY = "35261011222333000181550010000123451123456784";
const TEMPLATE_CNPJ = "11222333000181";
const TEMPLATE_BARCODE_1 = "7891234567895";
const TEMPLATE_BARCODE_3 = "7890000000017";
const TEMPLATE = xmlFixture("nfe-completa.xml");

export const randomBarcode = () => `789${Array.from({ length: 10 }, () => Math.floor(Math.random() * 10)).join("")}`;

export type Note = { key: string; cnpj: string; barcode1: string; barcode3: string };

export function newNote(overrides: Partial<Note> = {}): Note {
  const cnpj = overrides.cnpj ?? randomCnpj();
  return {
    cnpj,
    key: overrides.key ?? buildAccessKey({ cnpj }),
    barcode1: overrides.barcode1 ?? randomBarcode(),
    barcode3: overrides.barcode3 ?? randomBarcode(),
  };
}

export function noteXml(note: Note, mutate: (xml: string) => string = (x) => x): string {
  return mutate(
    TEMPLATE.replaceAll(TEMPLATE_KEY, note.key)
      .replaceAll(TEMPLATE_CNPJ, note.cnpj)
      .replaceAll(TEMPLATE_BARCODE_1, note.barcode1)
      .replaceAll(TEMPLATE_BARCODE_3, note.barcode3),
  );
}

export const BOUNDARY = "----tx-test-nfe-boundary";

export function multipart(parts: { name: string; filename?: string; contentType?: string; content: string | Buffer }[]) {
  const chunks: Buffer[] = [];
  for (const p of parts) {
    const disposition = `form-data; name="${p.name}"${p.filename ? `; filename="${p.filename}"` : ""}`;
    chunks.push(
      Buffer.from(
        `--${BOUNDARY}\r\nContent-Disposition: ${disposition}\r\n` +
          (p.contentType ? `Content-Type: ${p.contentType}\r\n` : "") +
          "\r\n",
      ),
      Buffer.isBuffer(p.content) ? p.content : Buffer.from(p.content),
      Buffer.from("\r\n"),
    );
  }
  chunks.push(Buffer.from(`--${BOUNDARY}--\r\n`));
  return Buffer.concat(chunks);
}
