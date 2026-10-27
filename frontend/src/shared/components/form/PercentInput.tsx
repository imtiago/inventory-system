import { forwardRef, type ChangeEvent, type InputHTMLAttributes } from 'react';

import { percentTextToBps } from '@/shared/utils/percent';

export interface PercentInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'inputMode'> {
  /** Chamado a cada digitação com os basis points (30% = 3000), ou null se vazio/inválido/mais de 2 casas. */
  onBpsChange?: (bps: number | null) => void;
  wrapperClassName?: string;
}

const base = 'w-full min-h-11 rounded-lg border border-input bg-surface py-2.5 pl-3 pr-9 text-base text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:opacity-50 sm:text-sm';

/** Campo de percentual: teclado decimal, vírgula como decimal, sufixo "%". O valor é o texto digitado. */
export const PercentInput = forwardRef<HTMLInputElement, PercentInputProps>(function PercentInput({ onBpsChange, onChange, className, wrapperClassName, placeholder = '0,00', ...rest }, ref) {
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    onChange?.(event);
    onBpsChange?.(percentTextToBps(event.target.value));
  }

  return (
    <div className={`relative ${wrapperClassName ?? ''}`}>
      <input {...rest} ref={ref} type="text" inputMode="decimal" autoComplete="off" placeholder={placeholder} onChange={handleChange} className={className ?? base} />
      <span aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">
        %
      </span>
    </div>
  );
});
