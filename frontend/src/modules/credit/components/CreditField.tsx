import type { ReactNode } from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';

import { FieldError, MoneyInput, PercentInput, fieldA11y } from '@/shared/components/form';

export const inputClass = 'w-full min-h-11 rounded-lg border border-input bg-surface p-3 text-base text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:opacity-50 sm:text-sm';

interface Props {
  id: string;
  label: ReactNode;
  /** Nome acessível mais completo que o rótulo visível (deve conter o texto do rótulo). */
  ariaLabel?: string;
  kind: 'money' | 'percent' | 'int';
  registration: UseFormRegisterReturn;
  error?: string;
  hint?: string;
  placeholder?: string;
}

/** Campo rotulado das telas de crédito: rótulo com `htmlFor`, erro ligado por `aria-describedby`. */
export function CreditField({ id, label, ariaLabel, kind, registration, error, hint, placeholder }: Props) {
  const a11y = { ...fieldA11y(id, error), ...(ariaLabel ? { 'aria-label': ariaLabel } : {}) };

  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1 block font-medium">
        {label}
      </label>
      {kind === 'money' && <MoneyInput id={id} {...a11y} {...registration} />}
      {kind === 'percent' && <PercentInput id={id} {...a11y} {...registration} />}
      {kind === 'int' && <input id={id} type="text" inputMode="numeric" autoComplete="off" placeholder={placeholder} className={inputClass} {...a11y} {...registration} />}
      {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
      <FieldError id={id} message={error} />
    </div>
  );
}
