import { toCents } from '@/shared/utils/money';

/** Draft item: numeric fields kept as typed strings (reais for money). */
export interface IPurchaseDraftItem {
  productVariantId: string;
  productName: string;
  productCode: string;
  quantity: string;
  unitPrice: string;
  discount: string;
  freight: string;
  tax: string;
}

/** Typed text -> number; "" is 0 and "," is accepted as the decimal separator. NaN when not numeric. */
export function parseNumber(text: string): number {
  const normalized = text.trim().replace(',', '.');

  return normalized === '' ? 0 : Number(normalized);
}

export function parseQuantity(text: string): number | null {
  const value = parseNumber(text);

  return text.trim() !== '' && Number.isInteger(value) && value >= 1 ? value : null;
}

/** Same rule as the backend: quantity x unitPrice - discount + freight + tax, in cents. null when a field is invalid. */
export function itemTotalCents(item: IPurchaseDraftItem): number | null {
  const quantity = parseQuantity(item.quantity);
  const money = [item.unitPrice, item.discount, item.freight, item.tax].map(parseNumber);

  if (quantity === null || money.some((value) => !Number.isFinite(value) || value < 0)) return null;

  const [unitPrice, discount, freight, tax] = money.map(toCents);

  return quantity * unitPrice - discount + freight + tax;
}
