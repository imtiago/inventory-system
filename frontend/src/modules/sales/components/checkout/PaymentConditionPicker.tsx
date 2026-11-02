import { Banknote, CalendarClock, CreditCard, QrCode, WalletCards, type LucideIcon } from 'lucide-react';

import type { SalePaymentCondition } from '../../types';
import { CHECKOUT_CONDITIONS, CONDITION_LABELS } from '../../utils/checkout';

const ICONS: Record<SalePaymentCondition, LucideIcon> = {
  CASH: Banknote,
  PIX: QrCode,
  DEBIT_CARD: WalletCards,
  CREDIT_CARD: CreditCard,
  CREDIARIO: CalendarClock,
};

interface Props {
  value: SalePaymentCondition;
  onChange: (condition: SalePaymentCondition) => void;
  disabled?: boolean;
}

/** Condição de pagamento da venda: botões de rádio (teclado: setas), um por condição. */
export function PaymentConditionPicker({ value, onChange, disabled = false }: Props) {
  return (
    <fieldset disabled={disabled} className="min-w-0">
      <legend className="mb-3 text-base font-semibold">Condição de pagamento</legend>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {CHECKOUT_CONDITIONS.map((condition) => {
          const Icon = ICONS[condition];
          return (
            <label
              key={condition}
              className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-input bg-surface px-3 py-2.5 text-sm font-medium transition hover:bg-surface-muted has-[:checked]:border-primary has-[:checked]:bg-primary has-[:checked]:text-primary-foreground has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2"
            >
              <input type="radio" name="payment-condition" value={condition} checked={value === condition} onChange={() => onChange(condition)} className="sr-only" />
              <Icon size={18} aria-hidden="true" className="shrink-0" />
              <span>{CONDITION_LABELS[condition]}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
