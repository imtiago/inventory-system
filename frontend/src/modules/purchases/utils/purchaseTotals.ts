import { fromCents, moneyTextError, parseMoneyToCents, toCents } from '@/shared/utils/money';

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

/** True when the typed money has more than 2 decimal places (never silently rounded). */
export function hasTooManyDecimals(text: string): boolean {
  return !/^\d*(\.\d{0,2})?$/.test(text.trim().replace(',', '.'));
}

/** Money as sent to the API: always the value derived from cents, i.e. exactly what is shown. */
export function moneyToSend(text: string): number {
  return fromCents(toCents(parseNumber(text)));
}

export function parseQuantity(text: string): number | null {
  const value = parseNumber(text);

  return text.trim() !== '' && Number.isInteger(value) && value >= 1 ? value : null;
}

/** pt-BR money field of the purchase form: blank means 0. Error message to show under the field, or null when valid. */
export function moneyFieldError(text: string): string | null {
  return moneyTextError(text, { allowEmpty: true });
}

/** Cents of a purchase money field (blank = 0); null when invalid. */
export function moneyFieldCents(text: string): number | null {
  return text.trim() === '' ? 0 : parseMoneyToCents(text);
}

/** Money field as sent to the API (reais derived from cents); 0 when blank or invalid. */
export function moneyFieldToSend(text: string): number {
  return fromCents(moneyFieldCents(text) ?? 0);
}

/** Same rule as the backend: quantity x unitPrice - discount + freight + tax, in cents. null when a field is invalid. */
export function itemTotalCents(item: IPurchaseDraftItem): number | null {
  const quantity = parseQuantity(item.quantity);
  const money = [item.unitPrice, item.discount, item.freight, item.tax].map(moneyFieldCents);

  if (quantity === null || money.some((value) => value === null || value < 0)) return null;

  const [unitPrice, discount, freight, tax] = money as number[];

  return quantity * unitPrice - discount + freight + tax;
}
