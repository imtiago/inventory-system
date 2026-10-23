import { XMLParser, XMLValidator } from "fast-xml-parser";
import { BusinessRuleError, ErrorCodes, ValidationError } from "@shared/domain/errors";
import { isValidAccessKey } from "@shared/domain/accessKey";
import { businessDateOfInstant } from "@shared/domain/businessDate";
import { isValidCnpj, isValidCpf } from "@shared/domain/document";
import {
  itemCostCents,
  type NfeDocument,
  type NfeInstallment,
  type NfeItem,
  type NfeLot,
  type NfeQuantity,
  type NfeSupplier,
  type NfeTotals,
} from "@nfe-import/domain/NfeDocument";

type XmlNode = Record<string, unknown>;

// Anti-XXE / billion laughs: nada de DTD. Checado no texto, antes de qualquer parse.
const DTD_PATTERN = /<!DOCTYPE|<!ENTITY/i;

// Entidades predefinidas do XML + referências numéricas. Como DTD é rejeitado,
// não existem entidades declaradas; o parser roda com `processEntities: false`
// e só estas são decodificadas, aqui, sobre o texto já extraído.
const ENTITY_PATTERN = /&(lt|gt|amp|quot|apos|#\d+|#x[0-9a-fA-F]+);/g;
const NAMED_ENTITIES: Record<string, string> = { lt: "<", gt: ">", amp: "&", quot: '"', apos: "'" };

function decodeEntities(value: string): string {
  return value.replace(ENTITY_PATTERN, (match, name: string) => {
    if (name[0] !== "#") return NAMED_ENTITIES[name];
    const code = name[1] === "x" ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
  });
}

const ARRAY_TAGS = new Set(["det", "dup", "rastro"]);

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
  parseTagValue: false,
  parseAttributeValue: false,
  processEntities: false,
  htmlEntities: false,
  trimValues: true,
  isArray: (name) => ARRAY_TAGS.has(name),
});

const MONEY_PATTERN = /^(\d+)(?:\.(\d+))?$/;
const QUANTITY_PATTERN = /^(\d+)(?:\.(\d{1,4}))?$/;
const DECIMAL_PATTERN = /^(\d+)(?:\.(\d+))?$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function invalidFile(): ValidationError {
  return new ValidationError(
    "Arquivo XML inválido.",
    [{ field: "file", message: "Arquivo XML inválido." }],
    ErrorCodes.INVALID_FILE_CONTENT,
  );
}

function invalidNfe(message: string): BusinessRuleError {
  return new BusinessRuleError(message, ErrorCodes.INVALID_NFE);
}

function isNode(value: unknown): value is XmlNode {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function child(node: unknown, name: string): XmlNode | undefined {
  if (!isNode(node)) return undefined;
  const value = node[name];
  if (Array.isArray(value)) return isNode(value[0]) ? value[0] : undefined;
  return isNode(value) ? value : undefined;
}

function children(node: unknown, name: string): XmlNode[] {
  if (!isNode(node)) return [];
  const value = node[name];
  const list = Array.isArray(value) ? value : value === undefined ? [] : [value];
  // `<dup/>` vazio vira "" — vira nó vazio para os campos ficarem ausentes.
  return list.map((v) => (isNode(v) ? v : {}));
}

/** Texto de um filho (ou atributo com "@_"), decodificado e aparado; ausente/vazio → undefined. */
function text(node: unknown, name: string): string | undefined {
  if (!isNode(node)) return undefined;
  let value = node[name];
  if (Array.isArray(value)) value = value[0];
  if (isNode(value)) value = value["#text"];
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const decoded = decodeEntities(String(value)).trim();
  return decoded === "" ? undefined : decoded;
}

function canonicalDecimal(int: string, frac: string | undefined): string {
  const i = int.replace(/^0+(?=\d)/, "");
  const f = (frac ?? "").replace(/0+$/, "");
  return f ? `${i}.${f}` : i;
}

function cents(node: unknown, name: string, what: string): number {
  const raw = text(node, name);
  if (raw === undefined) return 0;
  const m = MONEY_PATTERN.exec(raw);
  if (!m) throw invalidNfe(`Valor inválido na NF-e (${what}).`);
  const [, int, frac = ""] = m;
  const padded = frac.padEnd(3, "0");
  let value = Number(int) * 100 + Number(padded.slice(0, 2));
  // Mais de 2 casas (fora do layout): meio para cima, pelo 3º dígito.
  if (Number(padded[2]) >= 5) value += 1;
  if (!Number.isSafeInteger(value)) throw invalidNfe(`Valor inválido na NF-e (${what}).`);
  return value;
}

function quantity(node: unknown, name: string, what: string): NfeQuantity {
  const raw = text(node, name);
  const m = raw === undefined ? null : QUANTITY_PATTERN.exec(raw);
  if (!m) throw invalidNfe(`Quantidade inválida na NF-e (${what}).`);
  const q = canonicalDecimal(m[1], m[2]);
  if (!Number.isSafeInteger(Number(m[1]) * 10_000)) throw invalidNfe(`Quantidade inválida na NF-e (${what}).`);
  return q;
}

function date(node: unknown, name: string): string | null {
  const raw = text(node, name);
  return raw !== undefined && DATE_PATTERN.test(raw) ? raw : null;
}

function barcodeOf(prod: XmlNode): string | null {
  for (const tag of ["cEAN", "cEANTrib"]) {
    const value = text(prod, tag);
    if (value !== undefined && value.toUpperCase() !== "SEM GTIN") return value;
  }
  return null;
}

/** Soma de campos em qualquer grupo ICMS* (ICMS10, ICMS40, ICMS90, ICMSPart, ICMSSN201...). */
function icmsSum(imposto: XmlNode | undefined, fields: string[], what: string): number {
  const icms = child(imposto, "ICMS");
  if (!icms) return 0;
  let total = 0;
  for (const [key, group] of Object.entries(icms)) {
    if (!key.startsWith("ICMS") || !isNode(group)) continue;
    for (const field of fields) total += cents(group, field, what);
  }
  return total;
}

export class NfeParser {
  parse(input: string | Buffer): NfeDocument {
    const xml = this.decode(input);
    if (DTD_PATTERN.test(xml)) throw invalidFile();
    if (xml.trim() === "" || XMLValidator.validate(xml) !== true) throw invalidFile();

    let root: unknown;
    try {
      root = xmlParser.parse(xml);
    } catch {
      throw invalidFile();
    }

    const nfe = child(child(root, "nfeProc"), "NFe") ?? child(root, "NFe");
    const inf = child(nfe, "infNFe");
    if (!inf) throw invalidNfe("O arquivo não é uma NF-e.");

    const ide = child(inf, "ide");
    if (text(ide, "mod") !== "55") throw invalidNfe("Apenas NF-e modelo 55 é suportada.");

    const id = text(inf, "@_Id") ?? "";
    const accessKey = id.replace(/^NFe/, "");
    if (!isValidAccessKey(accessKey)) throw invalidNfe("Chave de acesso inválida.");

    const dets = children(inf, "det");
    if (dets.length === 0) throw invalidNfe("A NF-e não possui itens.");

    const supplier = this.supplier(child(inf, "emit"));
    const issueDate = this.issueDate(ide);
    const items = dets.map((det, i) => this.item(det, i));
    const totals = this.totals(child(child(inf, "total"), "ICMSTot"));

    const itemsTotal = items.reduce((sum, item) => sum + itemCostCents(item), 0);
    if (Math.abs(itemsTotal - totals.total) > items.length) throw invalidNfe("Totais da nota não conferem.");

    const installments: NfeInstallment[] = children(child(inf, "cobr"), "dup").map((dup, i) => ({
      number: text(dup, "nDup") ?? null,
      dueDate: date(dup, "dVenc") ?? issueDate,
      amount: cents(dup, "vDup", `duplicata ${i + 1}`),
    }));

    return {
      accessKey,
      number: text(ide, "nNF") ?? "",
      series: text(ide, "serie") ?? "",
      issueDate,
      supplier,
      totals,
      items,
      installments,
    };
  }

  private decode(input: string | Buffer): string {
    let xml: string;
    if (typeof input === "string") {
      xml = input;
    } else {
      // NF-e é UTF-8. Outra codificação (ex.: UTF-16) poderia esconder um DOCTYPE da checagem.
      if (input.includes(0)) throw invalidFile();
      xml = input.toString("utf-8");
    }
    if (xml.includes("\u0000")) throw invalidFile();
    return xml.replace(/^﻿/, "");
  }

  private supplier(emit: XmlNode | undefined): NfeSupplier {
    const cnpj = text(emit, "CNPJ");
    const cpf = text(emit, "CPF");
    // No XML o documento vem só com dígitos; máscara não é aceita.
    let document: string | null = null;
    if (cnpj !== undefined) document = /^\d{14}$/.test(cnpj) && isValidCnpj(cnpj) ? cnpj : null;
    else if (cpf !== undefined) document = /^\d{11}$/.test(cpf) && isValidCpf(cpf) ? cpf : null;
    if (!document) throw invalidNfe("Emitente sem CNPJ/CPF válido.");
    return {
      document,
      name: text(emit, "xNome") ?? "",
      tradeName: text(emit, "xFant") ?? null,
      email: null,
      phone: text(child(emit, "enderEmit"), "fone") ?? null,
    };
  }

  private issueDate(ide: XmlNode | undefined): string {
    const dhEmi = text(ide, "dhEmi");
    const dEmi = text(ide, "dEmi");
    const issueDate =
      dhEmi !== undefined ? businessDateOfInstant(dhEmi)
      : dEmi !== undefined && DATE_PATTERN.test(dEmi) ? dEmi
      : null;
    if (!issueDate) throw invalidNfe("Data de emissão inválida.");
    return issueDate;
  }

  private item(det: XmlNode, position: number): NfeItem {
    const index = Number(text(det, "@_nItem") ?? position + 1);
    const what = `item ${index}`;
    const prod = child(det, "prod") ?? {};
    const imposto = child(det, "imposto");

    const unitPriceRaw = text(prod, "vUnCom");
    const unitPriceMatch = unitPriceRaw === undefined ? null : DECIMAL_PATTERN.exec(unitPriceRaw);

    const lots: NfeLot[] = children(prod, "rastro").map((rastro) => ({
      batchNumber: text(rastro, "nLote") ?? "",
      quantity: quantity(rastro, "qLote", `lote do ${what}`),
      manufacturingDate: date(rastro, "dFab"),
      expirationDate: date(rastro, "dVal"),
    }));

    const qty = quantity(prod, "qCom", what);
    if (/^0(\.0+)?$/.test(qty)) throw invalidNfe(`Quantidade inválida na NF-e (${what}).`);

    return {
      index: Number.isSafeInteger(index) ? index : position + 1,
      supplierCode: text(prod, "cProd") ?? "",
      barcode: barcodeOf(prod),
      name: text(prod, "xProd") ?? "",
      ncm: text(prod, "NCM") ?? null,
      cfop: text(prod, "CFOP") ?? null,
      unit: text(prod, "uCom") ?? "",
      quantity: qty,
      unitPrice: unitPriceMatch ? canonicalDecimal(unitPriceMatch[1], unitPriceMatch[2]) : "0",
      productsTotal: cents(prod, "vProd", what),
      discount: cents(prod, "vDesc", what),
      freight: cents(prod, "vFrete", what),
      insurance: cents(prod, "vSeg", what),
      other: cents(prod, "vOutro", what),
      icmsRelief: icmsSum(imposto, ["vICMSDeson"], what),
      importTax: cents(child(imposto, "II"), "vII", what),
      ipi:
        cents(child(child(imposto, "IPI"), "IPITrib"), "vIPI", what) +
        cents(child(child(det, "impostoDevol"), "IPI"), "vIPIDevol", what),
      icmsSt: icmsSum(imposto, ["vICMSST", "vFCPST"], what),
      lots,
    };
  }

  private totals(tot: XmlNode | undefined): NfeTotals {
    const what = "totais";
    return {
      products: cents(tot, "vProd", what),
      discount: cents(tot, "vDesc", what),
      freight: cents(tot, "vFrete", what),
      insurance: cents(tot, "vSeg", what),
      other: cents(tot, "vOutro", what),
      icmsRelief: cents(tot, "vICMSDeson", what),
      importTax: cents(tot, "vII", what),
      ipi: cents(tot, "vIPI", what) + cents(tot, "vIPIDevol", what),
      icmsSt: cents(tot, "vST", what) + cents(tot, "vFCPST", what),
      total: cents(tot, "vNF", what),
    };
  }
}
