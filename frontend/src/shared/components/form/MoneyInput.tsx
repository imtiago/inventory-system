import { forwardRef, type ChangeEvent, type InputHTMLAttributes } from 'react';

import { parseMoneyToCents } from '@/shared/utils/money';

export interface MoneyInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'inputMode'> {
  /** Chamado a cada digitação com os centavos inteiros (ou null se vazio/inválido/mais de 2 casas). */
  onCentsChange?: (cents: number | null) => void;
  wrapperClassName?: string;
}

const base = 'w-full min-h-11 rounded-lg border border-gray-200 bg-white py-2.5 pl-10 pr-3 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-50 sm:text-sm';

/** Campo de dinheiro único: teclado decimal, aceita vírgula, mostra "R$". O valor é o texto digitado. */
export const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(function MoneyInput({ onCentsChange, onChange, className, wrapperClassName, placeholder = '0,00', ...rest }, ref) {
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    onChange?.(event);
    onCentsChange?.(parseMoneyToCents(event.target.value));
  }

  return (
    <div className={`relative ${wrapperClassName ?? ''}`}>
      <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
        R$
      </span>
      <input {...rest} ref={ref} type="text" inputMode="decimal" autoComplete="off" placeholder={placeholder} onChange={handleChange} className={className ?? base} />
    </div>
  );
});
