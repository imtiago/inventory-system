import { divideCentsRoundHalfUp } from "@shared/domain/money";
import { InternalErrorCodes, InternalInvariantError } from "@shared/domain/errors";
import { itemCostCents, NfeItem, QUANTITY_SCALE, quantityToScaled } from "./NfeDocument";
import { MAX_AMOUNT_CENTS, MAX_QUANTITY } from "@shared/domain/limits";
import {
  nfeItemAmountTooLarge,
  nfeItemUnitsTooLarge,
  nfeLotsExceedQuantity,
  nfeQuantityNotInteger,
  nfeTotalTooLarge,
  nfeUnsupportedItem,
} from "./errors/nfeImportErrors";

/** Lote em unidades (quantidade da nota × unidades por embalagem). */
export interface NfeUnitLot {
  batchNumber: string;
  quantity: number;
  /** "YYYY-MM-DD" */
  manufacturingDate: string | null;
  /** "YYYY-MM-DD" */
  expirationDate: string | null;
}

export interface NfeItemUnits {
  units: number;
  lots: NfeUnitLot[];
}

/**
 * Converte o item da nota em unidades: qCom × unitsPerPackage (e cada lote qLote ×
 * unitsPerPackage) precisa ser inteiro → senão 422 NFE_QUANTITY_NOT_INTEGER.
 * Item com indTot = 0 → 422 NFE_UNSUPPORTED_ITEM (não entra no vNF; não suportado).
 * Lotes sem número são ignorados (as unidades entram sem lote); lotes somando mais que
 * o item → 422 INVALID_NFE. Unidades acima de 1.000.000 (teto do pedido manual) → 422
 * INVALID_NFE "Item n: …".
 */
export function nfeItemUnits(item: NfeItem, unitsPerPackage: number): NfeItemUnits {
  if (!item.composesTotal) throw nfeUnsupportedItem(item.index);
  const toUnits = (quantity: string) => {
    const scaled = quantityToScaled(quantity) * unitsPerPackage;
    if (!Number.isSafeInteger(scaled) || scaled % QUANTITY_SCALE !== 0) throw nfeQuantityNotInteger(item.index);
    return scaled / QUANTITY_SCALE;
  };
  const units = toUnits(item.quantity);
  if (units < 1) throw nfeQuantityNotInteger(item.index);
  if (units > MAX_QUANTITY) throw nfeItemUnitsTooLarge(item.index);
  const lots = item.lots
    .filter((lot) => lot.batchNumber.trim() !== "")
    .map((lot) => ({
      batchNumber: lot.batchNumber.trim(),
      quantity: toUnits(lot.quantity),
      manufacturingDate: lot.manufacturingDate,
      expirationDate: lot.expirationDate,
    }))
    .filter((lot) => lot.quantity > 0);
  if (lots.reduce((sum, lot) => sum + lot.quantity, 0) > units) throw nfeLotsExceedQuantity(item.index);
  return { units, lots };
}

export interface NfeResolvedItem {
  item: NfeItem;
  productVariantId: string;
  units: NfeItemUnits;
}

/** Item do pedido gerado da nota (centavos), com os lotes a receber. */
export interface NfePurchaseLine {
  productVariantId: string;
  quantity: number;
  unitPriceCents: number;
  discountCents: number;
  freightCents: number;
  taxCents: number;
  /** Σ custo (composição do vNF) dos itens da nota desta variante = total do item do pedido. */
  costCents: number;
  /** Lotes da nota (somados por número); o restante da quantidade entra sem lote. */
  lots: NfeUnitLot[];
}

/**
 * Itens da nota → itens do pedido, um por variante (na ordem da primeira aparição).
 * Por variante, somam-se unidades e componentes:
 *   produtos = vProd; desconto = vDesc + vICMSDeson deduzido; frete = vFrete + vSeg + vOutro;
 *   imposto = vICMSST + vFCPST + vIPI + vIPIDevol + vII.
 * unitPrice = round-half-up(produtos / unidades); o resíduo r = unidades × unitPrice − produtos
 * vai para o desconto (r > 0) ou para o imposto (r < 0), de modo que
 * total do item = unidades × unitPrice − desconto + frete + imposto = custo do item na nota, exato.
 * Cada valor do item e o total do pedido têm de caber em DECIMAL(12,2) → senão 422 INVALID_NFE
 * (com o primeiro item da nota daquela variante).
 */
export function toPurchaseLines(resolved: NfeResolvedItem[]): NfePurchaseLine[] {
  const byVariant = new Map<
    string,
    {
      firstIndex: number;
      units: number;
      products: number;
      discount: number;
      freight: number;
      tax: number;
      cost: number;
      lots: NfeUnitLot[];
    }
  >();
  for (const { item, productVariantId, units } of resolved) {
    const acc =
      byVariant.get(productVariantId) ??
      { firstIndex: item.index, units: 0, products: 0, discount: 0, freight: 0, tax: 0, cost: 0, lots: [] as NfeUnitLot[] };
    acc.units += units.units;
    acc.products += item.productsTotal;
    acc.discount += item.discount + item.icmsRelief;
    acc.freight += item.freight + item.insurance + item.other;
    acc.tax += item.icmsSt + item.ipi + item.importTax;
    acc.cost += itemCostCents(item);
    for (const lot of units.lots) {
      const same = acc.lots.find((l) => l.batchNumber === lot.batchNumber);
      if (same) same.quantity += lot.quantity;
      else acc.lots.push({ ...lot });
    }
    byVariant.set(productVariantId, acc);
  }

  const lines = [...byVariant].map(([productVariantId, acc]) => {
    const unitPriceCents = divideCentsRoundHalfUp(acc.products, acc.units);
    const residue = acc.units * unitPriceCents - acc.products;
    const line: NfePurchaseLine = {
      productVariantId,
      quantity: acc.units,
      unitPriceCents,
      discountCents: acc.discount + Math.max(residue, 0),
      freightCents: acc.freight,
      taxCents: acc.tax + Math.max(-residue, 0),
      costCents: acc.cost,
      lots: acc.lots,
    };
    const amounts = [acc.products, line.unitPriceCents, line.discountCents, line.freightCents, line.taxCents, line.costCents];
    if (amounts.some((cents) => cents > MAX_AMOUNT_CENTS)) throw nfeItemAmountTooLarge(acc.firstIndex);
    const total = line.quantity * line.unitPriceCents - line.discountCents + line.freightCents + line.taxCents;
    if (total !== line.costCents) {
      throw new InternalInvariantError("Total do item do pedido difere do custo da nota.", InternalErrorCodes.PURCHASE_ITEM_INVALID);
    }
    return line;
  });
  if (lines.reduce((sum, line) => sum + line.costCents, 0) > MAX_AMOUNT_CENTS) throw nfeTotalTooLarge();
  return lines;
}
