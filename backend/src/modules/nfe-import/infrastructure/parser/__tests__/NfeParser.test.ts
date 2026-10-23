import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { BusinessRuleError, ValidationError } from "@shared/domain/errors";
import { isValidAccessKey } from "@shared/domain/accessKey";
import { buildAccessKey } from "../../../../../test/accessKeyFixtures";
import { NfeParser } from "../NfeParser";
import { itemCostCents, quantityToNumber, quantityToScaled } from "../../../domain/NfeDocument";

const fixture = (name: string) =>
  readFileSync(fileURLToPath(new URL(`../../../__fixtures__/${name}`, import.meta.url)), "utf-8");

const parser = new NfeParser();

const FULL_KEY = "35261011222333000181550010000123451123456784";

function expectInvalidNfe(xml: string | Buffer, message: string) {
  assert.throws(
    () => parser.parse(xml),
    (e: unknown) => e instanceof BusinessRuleError && e.code === "INVALID_NFE" && e.message === message,
  );
}

function expectInvalidFile(xml: string | Buffer) {
  assert.throws(
    () => parser.parse(xml),
    (e: unknown) =>
      e instanceof ValidationError && e.code === "INVALID_FILE_CONTENT" && e.message === "Arquivo XML inválido.",
  );
}

describe("NfeParser", () => {
  test("nota completa: cabeçalho, emitente, 3 itens (SEM GTIN → null, IPI, ICMS-ST, desconto, frete), duplicatas e rastro", () => {
    const doc = parser.parse(fixture("nfe-completa.xml"));

    assert.equal(doc.accessKey, FULL_KEY);
    assert.equal(doc.number, "12345");
    assert.equal(doc.series, "1");
    assert.equal(doc.issueDate, "2026-10-23");
    assert.deepEqual(doc.supplier, {
      document: "11222333000181",
      name: "Distribuidora Exemplo Ltda",
      tradeName: "Exemplo Distribuidora",
      email: null,
      phone: "1133334444",
    });
    assert.deepEqual(doc.totals, {
      products: 38289,
      discount: 1199,
      freight: 700,
      insurance: 100,
      other: 50,
      ipi: 1205,
      icmsSt: 630,
      total: 39775,
    });

    assert.equal(doc.items.length, 3);
    const [a, b, c] = doc.items;
    assert.deepEqual(a, {
      index: 1,
      supplierCode: "A-001",
      barcode: "7891234567895",
      name: "Shampoo P&G 300ml",
      ncm: "33051000",
      cfop: "5102",
      unit: "CX",
      quantity: "2",
      unitPrice: "120.5",
      productsTotal: 24100,
      discount: 1100,
      freight: 500,
      insurance: 0,
      other: 0,
      ipi: 1205,
      icmsSt: 0,
      lots: [
        { batchNumber: "L001", quantity: "1", manufacturingDate: "2026-01-10", expirationDate: "2027-01-10" },
        { batchNumber: "L002", quantity: "1", manufacturingDate: "2026-02-15", expirationDate: "2027-02-15" },
      ],
    });
    assert.equal(b.barcode, null, "SEM GTIN → null");
    assert.equal(b.quantity, "10.5");
    assert.equal(quantityToScaled(b.quantity), 105000);
    assert.equal(quantityToNumber(b.quantity), 10.5);
    assert.equal(b.icmsSt, 630);
    assert.equal(b.ipi, 0, "IPINT → 0");
    assert.deepEqual([b.freight, b.insurance, b.other], [200, 100, 50]);
    assert.deepEqual(b.lots, []);
    assert.equal(c.barcode, "7890000000017", "cEAN vazio → cEANTrib");
    assert.equal(c.discount, 99);

    assert.deepEqual(doc.installments, [
      { number: "001", dueDate: "2026-11-22", amount: 13258 },
      { number: "002", dueDate: "2026-12-22", amount: 13258 },
      { number: "003", dueDate: "2027-01-21", amount: 13259 },
    ]);
  });

  test("custo por item em centavos e soma = vNF", () => {
    const doc = parser.parse(Buffer.from(fixture("nfe-completa.xml"), "utf-8"));
    const costs = doc.items.map(itemCostCents);
    assert.deepEqual(costs, [24705, 5170, 9900]);
    assert.equal(costs.reduce((s, c) => s + c, 0), doc.totals.total);
  });

  test("nota sem cobrança → installments []; NFe sem nfeProc, det único, emitente CPF", () => {
    const doc = parser.parse(fixture("nfe-sem-cobranca.xml"));
    assert.deepEqual(doc.installments, []);
    assert.equal(doc.items.length, 1);
    assert.equal(doc.items[0].supplierCode, "0042", "zeros à esquerda preservados");
    assert.equal(doc.items[0].quantity, "3");
    assert.equal(doc.supplier.document, "52998224725");
    assert.equal(doc.supplier.tradeName, null);
    assert.equal(doc.supplier.phone, null);
    assert.equal(doc.totals.total, 3000);
    assert.equal(doc.issueDate, "2026-10-23", "01:30-01:00 = 23:30 em Brasília do dia anterior");
  });

  test("modelo 65, chave com DV errado, sem itens, totais que não conferem → INVALID_NFE com mensagem", () => {
    expectInvalidNfe(fixture("nfce-modelo-65.xml"), "Apenas NF-e modelo 55 é suportada.");
    expectInvalidNfe(fixture("nfe-chave-dv-errado.xml"), "Chave de acesso inválida.");
    expectInvalidNfe(fixture("nfe-sem-itens.xml"), "A NF-e não possui itens.");
    expectInvalidNfe(fixture("nfe-totais-divergentes.xml"), "Totais da nota não conferem.");
    expectInvalidNfe("<?xml version=\"1.0\"?><pedido><item/></pedido>", "O arquivo não é uma NF-e.");

    const full = fixture("nfe-completa.xml");
    expectInvalidNfe(full.replace(`Id="NFe${FULL_KEY}"`, `Id="NFe${FULL_KEY.slice(1)}"`), "Chave de acesso inválida.");
    expectInvalidNfe(full.replace("<CNPJ>11222333000181</CNPJ>", "<CNPJ>11222333000180</CNPJ>"), "Emitente sem CNPJ/CPF válido.");
  });

  test("totais: tolerância de 1 centavo por item", () => {
    const full = fixture("nfe-completa.xml");
    assert.equal(parser.parse(full.replace("<vNF>397.75</vNF>", "<vNF>397.78</vNF>")).totals.total, 39778);
    expectInvalidNfe(full.replace("<vNF>397.75</vNF>", "<vNF>397.79</vNF>"), "Totais da nota não conferem.");
  });

  test("XML com DOCTYPE/ENTITY → INVALID_FILE_CONTENT sem expandir entidades", () => {
    const payload = fixture("xml-doctype-entity.xml");
    expectInvalidFile(payload);
    expectInvalidFile(Buffer.from(payload, "utf-8"));
    expectInvalidFile(payload.replace("<!DOCTYPE", "<!doctype"));
    expectInvalidFile(`<?xml version="1.0"?><!ENTITY x "y"><NFe/>`);
    // UTF-16 não passa pela checagem de texto → rejeitado também.
    expectInvalidFile(Buffer.from(payload, "utf16le"));
  });

  test("XML malformado → INVALID_FILE_CONTENT", () => {
    expectInvalidFile("<nfeProc><NFe><infNFe></NFe>");
    expectInvalidFile("isto não é xml");
    expectInvalidFile("");
  });

  test("dhEmi 2026-10-23T23:30:00-03:00 → issueDate 2026-10-23", () => {
    const full = fixture("nfe-completa.xml");
    assert.equal(parser.parse(full).issueDate, "2026-10-23");
    assert.equal(
      parser.parse(full.replace("2026-10-23T23:30:00-03:00", "2026-10-24T02:30:00Z")).issueDate,
      "2026-10-23",
    );
    // layout antigo: dEmi
    assert.equal(
      parser.parse(full.replace("<dhEmi>2026-10-23T23:30:00-03:00</dhEmi>", "<dEmi>2026-10-20</dEmi>")).issueDate,
      "2026-10-20",
    );
    expectInvalidNfe(full.replace("2026-10-23T23:30:00-03:00", "23/10/2026"), "Data de emissão inválida.");
  });

  test("valor monetário com formato inválido → INVALID_NFE (nunca float)", () => {
    const full = fixture("nfe-completa.xml");
    assert.throws(
      () => parser.parse(full.replace("<vProd>241.00</vProd>", "<vProd>241,00</vProd>")),
      (e: unknown) => e instanceof BusinessRuleError && e.code === "INVALID_NFE",
    );
  });

  test("buildAccessKey gera chaves modelo 55 com DV válido e distintas", () => {
    const keys = new Set(Array.from({ length: 50 }, () => buildAccessKey()));
    assert.equal(keys.size, 50);
    for (const k of keys) {
      assert.match(k, /^\d{44}$/);
      assert.equal(k.slice(20, 22), "55");
      assert.equal(isValidAccessKey(k), true);
    }
  });
});
