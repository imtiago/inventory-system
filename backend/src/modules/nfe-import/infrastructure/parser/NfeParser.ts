import { XMLParser, XMLValidator } from "fast-xml-parser";
import { BusinessRuleError, ErrorCodes, ValidationError } from "@shared/domain/errors";
import { isValidAccessKey } from "@shared/domain/accessKey";
import { MAX_AMOUNT_CENTS, MAX_QUANTITY } from "@shared/domain/limits";
import { businessDateOfInstant } from "@shared/domain/businessDate";
import { isValidCnpj, isValidCpf, normalizeDocument } from "@shared/domain/document";
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
// Intencional: um "<!DOCTYPE"/"<!ENTITY" literal dentro de comentário ou CDATA também
// é rejeitado (falso positivo seguro; NF-e real não tem isso).
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

function notAccepted(message: string): BusinessRuleError {
  return new BusinessRuleError(message, ErrorCodes.NFE_NOT_ACCEPTED);
}

/** "11144477735" → "111.444.777-35". */
function formatCpf(value: string): string {
  return /^\d{11}$/.test(value) ? value.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") : value;
}

/** "11222333000181" → "11.222.333/0001-81" (CNPJ alfanumérico também; outro formato volta como veio). */
function formatCnpj(value: string): string {
  const m = /^([0-9A-Z]{2})([0-9A-Z]{3})([0-9A-Z]{3})([0-9A-Z]{4})(\d{2})$/.exec(value);
  return m ? `${m[1]}.${m[2]}.${m[3]}/${m[4]}-${m[5]}` : value;
}

/** cStat de autorização de uso: 100 (autorizada) e 150 (autorizada fora de prazo). */
const AUTHORIZED_STATUS = new Set(["100", "150"]);

export interface NfeParserOptions {
  /** CNPJ da empresa (só dígitos/letras); definido → o destinatário da nota precisa ser este. */
  companyCnpj?: string;
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

/**
 * Onde o valor está, para as mensagens: `item` (nItem) → "Item n: …" (o front marca a
 * linha); senão o trecho da nota ("totais", "duplicata 2").
 */
type Where = string | { item: number };

const whatOf = (where: Where) => (typeof where === "string" ? where : `item ${where.item}`);

function amountTooLarge(where: Where): BusinessRuleError {
  return typeof where === "string"
    ? invalidNfe(`Valor acima do máximo permitido na NF-e (${where}).`)
    : invalidNfe(`Item ${where.item}: valor acima do máximo permitido.`);
}

/** Centavos de um campo monetário; acima do teto de DECIMAL(12,2) → 422 INVALID_NFE. */
function cents(node: unknown, name: string, where: Where): number {
  const what = whatOf(where);
  const raw = text(node, name);
  if (raw === undefined) return 0;
  const m = MONEY_PATTERN.exec(raw);
  if (!m) throw invalidNfe(`Valor inválido na NF-e (${what}).`);
  const [, int, frac = ""] = m;
  const padded = frac.padEnd(3, "0");
  let value = Number(int) * 100 + Number(padded.slice(0, 2));
  // Mais de 2 casas (fora do layout): meio para cima, pelo 3º dígito.
  if (Number(padded[2]) >= 5) value += 1;
  // Antes do "inteiro seguro": um valor enorme é "acima do máximo", não "inválido".
  if (value > MAX_AMOUNT_CENTS) throw amountTooLarge(where);
  if (!Number.isSafeInteger(value)) throw invalidNfe(`Valor inválido na NF-e (${what}).`);
  return value;
}

/** Quantidade (qCom/qLote) até 4 casas; acima de 1.000.000 → `tooLarge` (mesmo teto do pedido manual). */
function quantity(node: unknown, name: string, what: string, tooLarge: string): NfeQuantity {
  const raw = text(node, name);
  const m = raw === undefined ? null : QUANTITY_PATTERN.exec(raw);
  if (!m) throw invalidNfe(`Quantidade inválida na NF-e (${what}).`);
  const int = Number(m[1]);
  if (int > MAX_QUANTITY || (int === MAX_QUANTITY && /[1-9]/.test(m[2] ?? ""))) throw invalidNfe(tooLarge);
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
function icmsSum(imposto: XmlNode | undefined, fields: string[], what: Where): number {
  const icms = child(imposto, "ICMS");
  if (!icms) return 0;
  let total = 0;
  for (const [key, group] of Object.entries(icms)) {
    if (!key.startsWith("ICMS") || !isNode(group)) continue;
    for (const field of fields) total += cents(group, field, what);
  }
  return total;
}

/** vICMSDeson só dos grupos ICMS* com indDeduzDeson = 1 (NT 2023.004). */
function icmsReliefOf(imposto: XmlNode | undefined, what: Where): number {
  const icms = child(imposto, "ICMS");
  if (!icms) return 0;
  let total = 0;
  for (const [key, group] of Object.entries(icms)) {
    if (key.startsWith("ICMS") && isNode(group) && text(group, "indDeduzDeson") === "1") {
      total += cents(group, "vICMSDeson", what);
    }
  }
  return total;
}

const XML_DECLARATION_ENCODING = /^\s*(?:\uFEFF|\xEF\xBB\xBF)?\s*<\?xml[^>]*?\bencoding\s*=\s*["']([^"']+)["']/i;
const UTF8_LABELS = new Set(["utf-8", "utf8"]);
// Para o WHATWG, iso-8859-1 e latin1 são windows-1252 (superconjunto): o decoder é o mesmo.
const LATIN_LABELS = new Set(["iso-8859-1", "iso8859-1", "latin1", "latin-1", "windows-1252", "cp1252"]);

/** Decoder pelo `encoding` da declaração XML (padrão utf-8); só utf-8, iso-8859-1 e windows-1252. */
function decoderFor(buffer: Buffer): TextDecoder {
  const head = buffer.subarray(0, 200).toString("latin1");
  const label = XML_DECLARATION_ENCODING.exec(head)?.[1]?.trim().toLowerCase();
  if (label === undefined || UTF8_LABELS.has(label)) return new TextDecoder("utf-8");
  if (LATIN_LABELS.has(label)) return new TextDecoder("windows-1252");
  throw invalidFile();
}

export class NfeParser {
  private readonly companyCnpj: string | undefined;

  constructor(options: NfeParserOptions = {}) {
    this.companyCnpj = options.companyCnpj ? normalizeDocument(options.companyCnpj) : undefined;
  }

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

    const proc = child(root, "nfeProc");
    const nfe = child(proc, "NFe") ?? child(root, "NFe");
    const inf = child(nfe, "infNFe");
    if (!inf) throw invalidNfe("O arquivo não é uma NF-e.");

    const ide = child(inf, "ide");
    if (text(ide, "mod") !== "55") throw invalidNfe("Apenas NF-e modelo 55 é suportada.");

    const id = text(inf, "@_Id") ?? "";
    const accessKey = id.replace(/^NFe/, "");
    if (!isValidAccessKey(accessKey)) throw invalidNfe("Chave de acesso inválida.");

    this.assertAccepted(ide, child(inf, "dest"), child(child(proc, "protNFe"), "infProt"));

    const dets = children(inf, "det");
    if (dets.length === 0) throw invalidNfe("A NF-e não possui itens.");

    const supplier = this.supplier(child(inf, "emit"));
    const issueDate = this.issueDate(ide);
    const items = dets.map((det, i) => this.item(det, i));
    const seen = new Set<number>();
    for (const { index } of items) {
      if (seen.has(index)) throw invalidNfe(`NF-e com nItem repetido (${index}).`);
      seen.add(index);
    }
    const totals = this.totals(child(child(inf, "total"), "ICMSTot"));

    const composing = items.filter((item) => item.composesTotal);
    const itemsTotal = composing.reduce((sum, item) => sum + itemCostCents(item), 0);
    if (Math.abs(itemsTotal - totals.total) > composing.length) throw invalidNfe("Totais da nota não conferem.");

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

  /** Só NF-e normal de compra, autorizada e destinada à empresa (422 NFE_NOT_ACCEPTED). */
  private assertAccepted(ide: XmlNode | undefined, dest: XmlNode | undefined, infProt: XmlNode | undefined): void {
    if (text(ide, "finNFe") !== "1") {
      throw notAccepted("Somente NF-e normal de compra é aceita (esta é de devolução/complementar/ajuste).");
    }
    const tpNF = text(ide, "tpNF");
    if (tpNF !== "1") {
      throw notAccepted(`A nota não é uma venda do fornecedor para a empresa (tpNF=${tpNF ?? "ausente"}).`);
    }
    if (this.companyCnpj) {
      const recipient = text(dest, "CNPJ")?.toUpperCase();
      if (recipient !== this.companyCnpj) {
        const cpf = text(dest, "CPF");
        if (!recipient && cpf) throw notAccepted(`A nota é destinada a outro destinatário (CPF ${formatCpf(cpf)}).`);
        throw notAccepted(`A nota é destinada a outro CNPJ (${recipient ? formatCnpj(recipient) : "não informado"}).`);
      }
    }
    if (!infProt) throw notAccepted("Nota sem protocolo de autorização.");
    const status = text(infProt, "cStat") ?? "";
    if (!AUTHORIZED_STATUS.has(status)) throw notAccepted(`Nota não autorizada ou cancelada (situação ${status || "ausente"}).`);
  }

  private decode(input: string | Buffer): string {
    let xml: string;
    if (typeof input === "string") {
      xml = input;
    } else {
      // UTF-16 (byte 0) poderia esconder um DOCTYPE da checagem: recusado.
      if (input.includes(0)) throw invalidFile();
      xml = decoderFor(input).decode(input);
    }
    if (xml.includes("\u0000")) throw invalidFile();
    return xml.replace(/^﻿/, "");
  }

  private supplier(emit: XmlNode | undefined): NfeSupplier {
    const cnpj = text(emit, "CNPJ");
    const cpf = text(emit, "CPF");
    // No XML o documento vem sem máscara (CNPJ alfanumérico em maiúsculas); máscara não é aceita.
    let document: string | null = null;
    if (cnpj !== undefined) document = /^[0-9A-Z]{12}\d{2}$/.test(cnpj) && isValidCnpj(cnpj) ? cnpj : null;
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
    // Data local declarada na nota (como no DANFE), sem converter de fuso; `businessDateOfInstant`
    // só valida formato e calendário de `dhEmi`.
    const issueDate =
      dhEmi !== undefined ? (businessDateOfInstant(dhEmi) !== null ? dhEmi.slice(0, 10) : null)
      : dEmi !== undefined && DATE_PATTERN.test(dEmi) ? dEmi
      : null;
    if (!issueDate) throw invalidNfe("Data de emissão inválida.");
    return issueDate;
  }

  private item(det: XmlNode, position: number): NfeItem {
    const rawIndex = text(det, "@_nItem");
    const index = rawIndex !== undefined && /^[1-9]\d{0,8}$/.test(rawIndex) ? Number(rawIndex) : undefined;
    if (index === undefined) throw invalidNfe(`NF-e com item sem nItem válido (posição ${position + 1}).`);
    const what = `item ${index}`;
    const where: Where = { item: index };
    const prod = child(det, "prod") ?? {};
    const imposto = child(det, "imposto");

    const unitPriceRaw = text(prod, "vUnCom");
    const unitPriceMatch = unitPriceRaw === undefined ? null : DECIMAL_PATTERN.exec(unitPriceRaw);

    const lots: NfeLot[] = children(prod, "rastro").map((rastro) => ({
      batchNumber: text(rastro, "nLote") ?? "",
      quantity: quantity(
        rastro,
        "qLote",
        `lote do ${what}`,
        `Item ${index}: quantidade do lote acima do máximo permitido (1.000.000).`,
      ),
      manufacturingDate: date(rastro, "dFab"),
      expirationDate: date(rastro, "dVal"),
    }));

    for (const lot of lots) {
      if (lot.manufacturingDate && lot.expirationDate && lot.expirationDate < lot.manufacturingDate) {
        throw invalidNfe(`Item ${index}: validade do lote ${lot.batchNumber} anterior à fabricação.`);
      }
    }

    // Unidades por embalagem são conferidas na confirmação (qCom × unidades ≤ 1.000.000).
    const qty = quantity(prod, "qCom", what, `Item ${index}: quantidade acima do máximo permitido (1.000.000).`);
    if (/^0(\.0+)?$/.test(qty)) throw invalidNfe(`Quantidade inválida na NF-e (${what}).`);

    return {
      index,
      supplierCode: text(prod, "cProd") ?? "",
      barcode: barcodeOf(prod),
      name: text(prod, "xProd") ?? "",
      ncm: text(prod, "NCM") ?? null,
      cfop: text(prod, "CFOP") ?? null,
      unit: text(prod, "uCom") ?? "",
      quantity: qty,
      unitPrice: unitPriceMatch ? canonicalDecimal(unitPriceMatch[1], unitPriceMatch[2]) : "0",
      productsTotal: cents(prod, "vProd", where),
      discount: cents(prod, "vDesc", where),
      freight: cents(prod, "vFrete", where),
      insurance: cents(prod, "vSeg", where),
      other: cents(prod, "vOutro", where),
      icmsRelief: icmsReliefOf(imposto, where),
      importTax: cents(child(imposto, "II"), "vII", where),
      ipi:
        cents(child(child(imposto, "IPI"), "IPITrib"), "vIPI", where) +
        cents(child(child(det, "impostoDevol"), "IPI"), "vIPIDevol", where),
      icmsSt: icmsSum(imposto, ["vICMSST", "vFCPST"], where),
      composesTotal: text(prod, "indTot") !== "0",
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
