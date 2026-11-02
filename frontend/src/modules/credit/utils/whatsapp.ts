import type { ISaleDetail } from '@/modules/sales/types';
import { formatDateOnly } from '@/shared/utils/formatDateOnly';
import { formatCurrency } from '@/shared/utils/money';

/** DDD + 9 dígitos (celular): 11 dígitos, DDD de 11 a 99, começando em 9. O 55 do país é opcional. */
function mobileDigits(phone: string | null | undefined): string | null {
  if (!phone) return null;

  let digits = phone.replace(/\D/g, '');

  if (digits.length === 13 && digits.startsWith('55')) digits = digits.slice(2);

  return /^[1-9][1-9]9\d{8}$/.test(digits) ? digits : null;
}

export function isValidMobile(phone: string | null | undefined): boolean {
  return mobileDigits(phone) !== null;
}

/** Link `wa.me` (fase 1: só abre o WhatsApp com o texto pronto, sem API). Sem celular válido → null. */
export function buildWhatsAppLink(phone: string | null, text: string): string | null {
  const digits = mobileDigits(phone);

  return digits ? `https://wa.me/55${digits}?text=${encodeURIComponent(text)}` : null;
}

// O WhatsApp mostra o texto cru: espaço comum no lugar do espaço fixo do Intl.
const plain = (text: string) => text.replaceAll(String.fromCharCode(160), ' ');
const money = (value: number) => plain(formatCurrency(value));
const percent = (value: number) => `${String(value).replace('.', ',')}%`;

/** Resumo da venda no crediário e as parcelas em texto (a entrada, paga no ato, não entra na lista). */
export function buildCarneMessage(sale: ISaleDetail): string {
  const financing = sale.financing;
  const firstName = sale.customer.name.trim().split(/\s+/)[0] ?? '';
  const code = sale.id.slice(0, 8).toUpperCase();
  const lines = [`Olá, ${firstName}! Segue o resumo da sua compra no crediário (venda #${code}).`, ''];

  if (financing) {
    lines.push(`Preço à vista: ${money(financing.cashPrice)}`);
    if (financing.downPayment > 0) lines.push(`Entrada: ${money(financing.downPayment)}`);
    lines.push(`Valor financiado: ${money(financing.financedAmount)}`);
    lines.push(financing.monthlyRatePercent > 0 ? `Taxa: ${percent(financing.monthlyRatePercent)} ao mês` : 'Sem acréscimo');
    lines.push(`Total a prazo: ${money(financing.totalAmount)}`, '');
  }

  const all = sale.receivable?.parcels ?? [];
  const parcels = financing && financing.downPayment > 0 ? all.slice(1) : all;

  lines.push('Parcelas:');
  parcels.forEach((parcel, index) => lines.push(`${index + 1}/${parcels.length} - ${formatDateOnly(parcel.dueDate)} - ${money(parcel.amount)}`));
  lines.push('', 'Obrigado pela preferência!');

  return plain(lines.join('\n'));
}
