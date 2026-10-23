// Conteúdo lido de uma NF-e modelo 55 (layout 4.00). Dados puros (serializáveis em JSON).
//
// Convenções:
// - Dinheiro em centavos inteiros (lidos do texto do XML, sem aritmética de float).
// - Quantidades (`qCom`, `qLote`) como string decimal canônica, exata, até 4 casas,
//   sem zeros supérfluos ("2.0000" → "2", "10.5000" → "10.5"). Para cálculo use
//   `quantityToScaled` (inteiro em décimos de milésimo) ou `quantityToNumber`.
// - `unitPrice` (`vUnCom`, até 10 casas) também como string decimal canônica: é
//   informativo; o custo do item vem dos totais (`itemCostCents`).
// - Datas "YYYY-MM-DD".

export type NfeQuantity = string;

export interface NfeSupplier {
  /** CNPJ (14 posições, numérico ou alfanumérico em maiúsculas) ou CPF (11 dígitos), DV validado. */
  document: string;
  name: string;
  tradeName: string | null;
  /** O grupo `emit` da NF-e não tem e-mail: sempre null na leitura. */
  email: string | null;
  phone: string | null;
}

/** Totais (ICMSTot), mesmos componentes dos itens. */
export interface NfeTotals {
  products: number;
  discount: number;
  freight: number;
  insurance: number;
  other: number;
  /** ICMSTot/vICMSDeson como informado (informativo: o que deduz do vNF depende de indDeduzDeson por item). */
  icmsRelief: number;
  /** vII */
  importTax: number;
  /** vIPI + vIPIDevol */
  ipi: number;
  /** vST + vFCPST */
  icmsSt: number;
  /** vNF */
  total: number;
}

export interface NfeLot {
  batchNumber: string;
  quantity: NfeQuantity;
  manufacturingDate: string | null;
  expirationDate: string | null;
}

export interface NfeItem {
  /** nItem */
  index: number;
  supplierCode: string;
  barcode: string | null;
  name: string;
  ncm: string | null;
  cfop: string | null;
  unit: string;
  quantity: NfeQuantity;
  unitPrice: string;
  productsTotal: number;
  discount: number;
  freight: number;
  insurance: number;
  other: number;
  /**
   * vICMSDeson deduzido (subtrai do custo): só de grupos ICMS* com indDeduzDeson = 1
   * (NT 2023.004); sem o indicador → 0.
   */
  icmsRelief: number;
  /** II/vII */
  importTax: number;
  /** IPI/IPITrib/vIPI + impostoDevol/IPI/vIPIDevol */
  ipi: number;
  /** vICMSST + vFCPST de qualquer grupo ICMS* */
  icmsSt: number;
  /** prod/indTot: false (indTot = 0) → o item não compõe vProd/vNF e fica fora da conferência dos totais. */
  composesTotal: boolean;
  lots: NfeLot[];
}

export interface NfeInstallment {
  number: string | null;
  dueDate: string;
  amount: number;
}

export interface NfeDocument {
  accessKey: string;
  number: string;
  series: string;
  issueDate: string;
  supplier: NfeSupplier;
  totals: NfeTotals;
  items: NfeItem[];
  installments: NfeInstallment[];
}

export const QUANTITY_SCALE = 10_000;

const QUANTITY_PATTERN = /^\d+(\.\d{1,4})?$/;

/** Quantidade em décimos de milésimo (inteiro exato): "10.5" → 105000. */
export function quantityToScaled(quantity: NfeQuantity): number {
  if (!QUANTITY_PATTERN.test(quantity)) throw new RangeError(`Quantidade inválida: ${quantity}`);
  const [int, frac = ""] = quantity.split(".");
  return Number(int) * QUANTITY_SCALE + Number(frac.padEnd(4, "0"));
}

export function quantityToNumber(quantity: NfeQuantity): number {
  return quantityToScaled(quantity) / QUANTITY_SCALE;
}

/**
 * Custo do item (centavos), na composição oficial do vNF:
 * vProd − vDesc − vICMSDeson (deduzido) + vICMSST + vFCPST + vFrete + vSeg + vOutro + vII + vIPI + vIPIDevol.
 */
export function itemCostCents(item: NfeItem): number {
  return (
    item.productsTotal -
    item.discount -
    item.icmsRelief +
    item.icmsSt +
    item.freight +
    item.insurance +
    item.other +
    item.importTax +
    item.ipi
  );
}
