import { test } from "node:test";
import assert from "node:assert/strict";
import { decodeCsvBytes, parseCsv } from "@legacy-import/domain/csvReader";
import { LEGACY_COLUMNS, mapHeader, buildLegacyTemplateCsv } from "@legacy-import/domain/legacyTemplate";
import { BusinessRuleError, ValidationError } from "@shared/domain/errors";

const enc = (s: string) => new TextEncoder().encode(s);

test("UTF-8 com BOM e ';' -> cabeçalho limpo e células", () => {
  const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...enc("nome;valor_total\nJoão;10,00\n")]);
  const text = decodeCsvBytes(bytes);
  assert.ok(!text.includes("﻿"));
  const r = parseCsv(text);
  assert.deepEqual(r.header, ["nome", "valor_total"]);
  assert.deepEqual(r.rows, [{ line: 2, cells: ["João", "10,00"] }]);
});

test("windows-1252 (bytes de 'João;1.234,56')", () => {
  const bytes = new Uint8Array([0x4a, 0x6f, 0xe3, 0x6f, 0x3b, ...enc("1.234,56")]);
  assert.equal(decodeCsvBytes(bytes), "João;1.234,56");
});

test("separador ',' com aspas, valor com vírgula e aspas escapadas", () => {
  const r = parseCsv('nome,valor_total,observacao\n"Silva, Maria","1.234,56","disse ""oi"""\n');
  assert.deepEqual(r.rows[0].cells, ["Silva, Maria", "1.234,56", 'disse "oi"']);
});

test("quebra de linha dentro de aspas faz parte do campo", () => {
  const r = parseCsv('nome;valor_total;observacao\nAna;5;"a\nb"\nBia;6;x');
  assert.equal(r.rows[0].cells[2], "a\nb");
  assert.equal(r.rows[0].line, 2);
  assert.equal(r.rows[1].line, 4);
});

test("linhas vazias e só com ';;;' ignoradas; número da linha preservado", () => {
  const r = parseCsv("nome;valor_total\n\n;;\nAna;5\n  ;  \nBia;6\n");
  assert.deepEqual(r.rows.map((x) => x.line), [4, 6]);
});

test("CRLF, LF e última linha sem quebra", () => {
  assert.equal(parseCsv("a;b\r\n1;2\r\n3;4").rows.length, 2);
  assert.equal(parseCsv("a;b\n1;2\n3;4").rows.length, 2);
});

test("células com =,+,-,@ ficam como texto", () => {
  const r = parseCsv("nome;valor_total\n=CMD();-5\n");
  assert.deepEqual(r.rows[0].cells, ["=CMD()", "-5"]);
});

test("limites: > 500 linhas de dados → 422 LEGACY_BATCH_TOO_LARGE", () => {
  const ok = "nome;valor_total\n" + Array.from({ length: 500 }, () => "A;1").join("\n");
  assert.equal(parseCsv(ok).rows.length, 500);
  const big = "nome;valor_total\n" + Array.from({ length: 501 }, () => "A;1").join("\n");
  assert.throws(
    () => parseCsv(big),
    (e: unknown) =>
      e instanceof BusinessRuleError && (e as BusinessRuleError).code === "LEGACY_BATCH_TOO_LARGE" && /500 linhas/.test((e as Error).message),
  );
});

test("cabeçalho com acentos/caixa/espaços é reconhecido; sem obrigatórias falha", () => {
  const m = mapHeader(["Nome", " Valor Total ", "Valor_Pago", "Descrição"]);
  assert.deepEqual([m.nome, m.valor_total, m.valor_pago, m.descricao, m.celular], [0, 1, 2, 3, null]);
  assert.throws(
    () => mapHeader(["valor_total"]),
    (e: unknown) => e instanceof ValidationError && (e as Error).message === "Coluna obrigatória ausente: nome",
  );
  assert.throws(() => mapHeader(["nome"]), /Coluna obrigatória ausente: valor_total/);
});

test("modelo: BOM, CRLF, 9 colunas, lido de volta sem erro", () => {
  const csv = buildLegacyTemplateCsv();
  assert.ok(csv.startsWith("﻿"));
  assert.ok(csv.includes("\r\n"));
  const r = parseCsv(decodeCsvBytes(enc(csv)));
  assert.deepEqual(r.header, [...LEGACY_COLUMNS]);
  assert.equal(r.rows.length, 2);
  assert.doesNotThrow(() => mapHeader(r.header));
});

test('UTF-16 com BOM ("Texto Unicode" do Excel, separado por tabulação) é lido', () => {
  const text = "nome\tvalor_total\nJosé Lima\t10,00\n";
  const le = new Uint8Array([0xff, 0xfe, ...Buffer.from(text, "utf16le")]);
  const parsed = parseCsv(decodeCsvBytes(le));
  assert.deepEqual(parsed.header, ["nome", "valor_total"]);
  assert.deepEqual(parsed.rows[0].cells, ["José Lima", "10,00"]);
  const swapped = Buffer.from(text, "utf16le");
  swapped.swap16();
  const be = new Uint8Array([0xfe, 0xff, ...swapped]);
  assert.deepEqual(parseCsv(decodeCsvBytes(be)).rows[0].cells, ["José Lima", "10,00"]);
});
