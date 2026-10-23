import { fromCents, toCents } from '@/shared/utils/money';
import { hasTooManyDecimals, moneyToSend, parseNumber } from '@/modules/purchases/utils/purchaseTotals';
import type { IConfirmNfeDTO, IConfirmNfeItem, INfeImport, INfeItem } from '../types';

export type ItemMode = 'link' | 'createProduct' | 'createVariant';

export interface PickedVariant {
  id: string;
  label: string;
}

export interface PickedProduct {
  id: string;
  label: string;
}

/** Everything the user can set per item; the fields of the modes not selected are kept so switching back loses nothing. */
export interface ItemDraft {
  /** null: no suggestion yet and nothing chosen. */
  mode: ItemMode | null;
  unitsPerPackage: string;
  variant: PickedVariant | null;
  product: PickedProduct | null;
  newProductName: string;
  brandId: string;
  categoryId: string;
  variantName: string;
  barcode: string;
  salePrice: string;
}

export interface InstallmentDraft {
  dueDate: string;
  amount: string;
}

export interface SupplierDraft {
  name: string;
  email: string;
  phone: string;
}

const NOTE_SCALE = 10_000;

export function initialItemDraft(item: INfeItem): ItemDraft {
  return {
    mode: item.suggestion ? 'link' : null,
    unitsPerPackage: String(item.suggestion?.unitsPerPackage ?? 1),
    variant: item.suggestion ? { id: item.suggestion.productVariantId, label: item.suggestion.label } : null,
    product: null,
    newProductName: item.name,
    brandId: '',
    categoryId: '',
    variantName: 'Padrão',
    barcode: item.barcode ?? '',
    salePrice: '',
  };
}

export function initialInstallments(note: INfeImport): InstallmentDraft[] {
  if (note.installments.length > 0) return note.installments.map((i) => ({ dueDate: i.dueDate, amount: fromCents(toCents(i.amount)).toFixed(2) }));

  return [{ dueDate: note.issueDate, amount: fromCents(itemsTotalCents(note.items)).toFixed(2) }];
}

/** The purchase total the backend checks installments against: the sum of the items' costs (not vNF). */
export function itemsTotalCents(items: INfeItem[]): number {
  return items.reduce((sum, item) => sum + toCents(item.total), 0);
}

/** Integer >= 1, or null. */
export function parseUnitsPerPackage(text: string): number | null {
  const normalized = text.trim();

  return /^\d+$/.test(normalized) && Number(normalized) >= 1 ? Number(normalized) : null;
}

/** Quantity of the note (up to 4 decimals) x units per package; null when it is not a whole number of units. */
export function unitsOf(quantity: number, unitsPerPackage: number): number | null {
  const scaled = Math.round(quantity * NOTE_SCALE) * unitsPerPackage;

  return scaled % NOTE_SCALE === 0 ? scaled / NOTE_SCALE : null;
}

export function barcodeToSend(text: string, noteBarcode: string | null): string | null | undefined {
  const barcode = text.trim();

  if (barcode) return barcode;

  return noteBarcode ? null : undefined;
}

export function isValidSalePrice(text: string): boolean {
  const value = parseNumber(text);

  return text.trim() !== '' && !hasTooManyDecimals(text) && Number.isFinite(value) && value >= 0;
}

/** First reason the item blocks the submit, in Portuguese; null when it is ready. */
export function itemProblem(item: INfeItem, draft: ItemDraft): string | null {
  const prefix = `Item ${item.index}`;
  const upp = parseUnitsPerPackage(draft.unitsPerPackage);

  if (!draft.mode) return `${prefix}: escolha vincular a uma variante ou criar.`;
  if (upp === null) return `${prefix}: informe as unidades por embalagem (inteiro, 1 ou mais).`;
  if (unitsOf(item.quantity, upp) === null) return `${prefix}: a quantidade não resulta em unidades inteiras.`;

  if (draft.mode === 'link') return draft.variant ? null : `${prefix}: escolha a variante.`;

  if (draft.mode === 'createVariant' && !draft.product) return `${prefix}: escolha o produto.`;

  if (draft.mode === 'createProduct') {
    if (!draft.newProductName.trim()) return `${prefix}: informe o nome do produto.`;
    if (!draft.brandId) return `${prefix}: escolha a marca.`;
    if (!draft.categoryId) return `${prefix}: escolha a categoria.`;
  }

  if (!draft.variantName.trim()) return `${prefix}: informe o nome da variante.`;
  if (!isValidSalePrice(draft.salePrice)) return `${prefix}: informe o preço de venda (máximo 2 casas decimais).`;

  return null;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function installmentsSumCents(installments: InstallmentDraft[]): number {
  return installments.reduce((sum, row) => sum + toCents(parseNumber(row.amount) || 0), 0);
}

export function installmentsProblem(installments: InstallmentDraft[], issueDate: string, totalCents: number): string | null {
  if (installments.length === 0) return 'Informe ao menos uma parcela.';

  for (const [position, row] of installments.entries()) {
    const label = `Parcela ${position + 1}`;
    const value = parseNumber(row.amount);

    if (!DATE_PATTERN.test(row.dueDate)) return `${label}: informe o vencimento.`;
    if (row.dueDate < issueDate) return `${label}: o vencimento não pode ser anterior à emissão.`;
    if (row.amount.trim() === '' || !Number.isFinite(value) || value <= 0 || hasTooManyDecimals(row.amount)) return `${label}: informe um valor maior que zero com até 2 casas decimais.`;
  }

  return installmentsSumCents(installments) === totalCents ? null : 'A soma das parcelas difere do total do pedido.';
}

function itemBody(item: INfeItem, draft: ItemDraft): IConfirmNfeItem {
  const unitsPerPackage = parseUnitsPerPackage(draft.unitsPerPackage) as number;

  if (draft.mode === 'link') {
    return { index: item.index, link: { productVariantId: (draft.variant as PickedVariant).id, unitsPerPackage } };
  }

  const barcode = barcodeToSend(draft.barcode, item.barcode);

  return {
    index: item.index,
    create: {
      ...(draft.mode === 'createVariant'
        ? { productId: (draft.product as PickedProduct).id }
        : { newProduct: { name: draft.newProductName.trim(), brandId: draft.brandId, categoryId: draft.categoryId } }),
      variantName: draft.variantName.trim(),
      ...(barcode !== undefined ? { barcode } : {}),
      salePrice: moneyToSend(draft.salePrice),
      unitsPerPackage,
    },
  };
}

export function buildConfirmBody(args: {
  note: INfeImport;
  items: ItemDraft[];
  supplier: SupplierDraft;
  installments: InstallmentDraft[];
  receive: boolean;
}): IConfirmNfeDTO {
  const { note, items, supplier, installments, receive } = args;
  const email = supplier.email.trim();
  const phone = supplier.phone.replace(/\D/g, '');

  return {
    supplier: note.supplier.match
      ? { id: note.supplier.match.id }
      : { create: { name: supplier.name.trim(), ...(email ? { email } : {}), ...(phone ? { phone } : {}) } },
    items: note.items.map((item, position) => itemBody(item, items[position])),
    installments: installments.map((row) => ({ dueDate: row.dueDate, amount: moneyToSend(row.amount) })),
    receive,
  };
}

/** Which item (note index) a confirm error refers to: field path "items.<n>..." or "item <n>" in the message. */
export function errorItemIndex(error: { message: string; fieldErrors: Record<string, string> }, note: INfeImport): number | null {
  for (const field of Object.keys(error.fieldErrors)) {
    const match = /^items\.(\d+)\b/.exec(field);

    if (match) return note.items[Number(match[1])]?.index ?? null;
  }

  const byMessage = /\bitem\s+(\d+)/i.exec(error.message);

  return byMessage && note.items.some((item) => item.index === Number(byMessage[1])) ? Number(byMessage[1]) : null;
}
