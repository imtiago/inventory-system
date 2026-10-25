import { Minus, Plus } from 'lucide-react';
import type { InputHTMLAttributes } from 'react';

export interface QuantityInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'inputMode' | 'value' | 'onChange' | 'min' | 'max'> {
  value: string;
  onChange: (value: string) => void;
  min?: number;
  max?: number;
  inputClassName?: string;
}

const stepClass = 'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40';

/** Quantidade inteira com teclado numérico e botões − / + de 44 px. O valor é o texto digitado (só dígitos). */
export function QuantityInput({ value, onChange, min = 1, max, disabled, inputClassName, ...rest }: QuantityInputProps) {
  const current = value.trim() === '' ? null : Number(value);
  const canDecrease = !disabled && current !== null && current > min;
  const canIncrease = !disabled && (max === undefined || current === null || current < max);

  function step(delta: number) {
    const next = current === null ? min : Math.min(max ?? Infinity, Math.max(min, current + delta));
    onChange(String(next));
  }

  return (
    <div className="inline-flex items-center gap-2">
      <button type="button" aria-label="Diminuir quantidade" className={stepClass} disabled={!canDecrease} onClick={() => step(-1)}>
        <Minus size={18} aria-hidden="true" />
      </button>
      <input
        {...rest}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        min={min}
        max={max}
        autoComplete="off"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, ''))}
        className={inputClassName ?? 'h-11 w-16 rounded-lg border border-gray-300 px-2 text-center text-base disabled:opacity-50'}
      />
      <button type="button" aria-label="Aumentar quantidade" className={stepClass} disabled={!canIncrease} onClick={() => step(1)}>
        <Plus size={18} aria-hidden="true" />
      </button>
    </div>
  );
}
