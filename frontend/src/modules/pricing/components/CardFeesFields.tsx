import type { FieldErrors, UseFormRegister } from 'react-hook-form';

import { FieldError, PercentInput, fieldA11y } from '@/shared/components/form';
import { percentTextError } from '@/shared/utils/percent';

import type { SettingsFormValues } from '../types';

interface Props {
  register: UseFormRegister<SettingsFormValues>;
  errors: FieldErrors<SettingsFormValues>;
}

const validate = (value: string) => percentTextError(value) ?? true;
const inputId = (name: string) => `card-fee-${name}`;

/** Taxa de débito e de crédito de 1x a 12x. Uma coluna no celular, mais colunas a partir de `sm`. */
export function CardFeesFields({ register, errors }: Props) {
  const creditErrors = errors.credit;

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div className="max-w-xs">
        <label htmlFor={inputId('debit')} className="mb-1 block font-medium">
          Débito (%)
        </label>
        <PercentInput id={inputId('debit')} {...fieldA11y(inputId('debit'), errors.debit?.message)} {...register('debit', { validate })} />
        <FieldError id={inputId('debit')} message={errors.debit?.message} />
      </div>

      <div data-testid="credit-fees-grid" className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 12 }, (_, i) => {
          const id = inputId(`credit-${i + 1}`);
          const message = creditErrors?.[i]?.message;

          return (
            <div key={id}>
              <label htmlFor={id} className="mb-1 block text-sm font-medium">
                Crédito {i + 1}x (%)
              </label>
              <PercentInput id={id} {...fieldA11y(id, message)} {...register(`credit.${i}` as `credit.${number}`, { validate })} />
              <FieldError id={id} message={message} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
