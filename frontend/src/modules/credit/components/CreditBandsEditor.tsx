import { Plus, Trash2 } from 'lucide-react';
import { useFieldArray, useWatch, type Control, type FieldErrors, type UseFormGetValues, type UseFormRegister } from 'react-hook-form';

import { formatCents, parseMoneyToCents } from '@/shared/utils/money';

import { bandCeilingError, intError, MAX_INSTALLMENTS, type RulesFormValues } from '../utils/rulesForm';
import { CreditField } from './CreditField';

interface Props {
  control: Control<RulesFormValues>;
  register: UseFormRegister<RulesFormValues>;
  getValues: UseFormGetValues<RulesFormValues>;
  errors: FieldErrors<RulesFormValues>;
}

/** Faixas de valor da compra -> máximo de parcelas. A última faixa é sempre "acima" (sem teto). */
export function CreditBandsEditor({ control, register, getValues, errors }: Props) {
  const { fields, insert, remove } = useFieldArray({ control, name: 'bands' });
  const bands = useWatch({ control, name: 'bands' });
  const lastIndex = fields.length - 1;

  return (
    <fieldset className="flex min-w-0 flex-col gap-4 p-4 sm:p-6">
      <legend className="sr-only">Faixas de valor</legend>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted">Quanto maior a compra, mais parcelas a cliente pode ter. A última faixa vale para tudo que passa da anterior.</p>

        {fields.map((field, i) => {
          const isLast = i === lastIndex;
          const previous = i > 0 ? bands?.[i - 1]?.upTo : undefined;
          const previousCents = previous === undefined ? null : parseMoneyToCents(previous);
          const rowErrors = errors.bands?.[i];

          return (
            <div key={field.id} className="grid grid-cols-1 items-start gap-3 rounded-lg border border-border p-3 sm:grid-cols-[1fr_1fr_auto] sm:p-4">
              {isLast ? (
                <div className="flex min-h-11 flex-col justify-center">
                  <p className="font-medium">Faixa {i + 1}</p>
                  <p className="text-sm text-muted">
                    <span>{previousCents === null ? 'acima da faixa anterior' : `acima de ${formatCents(previousCents)}`}</span>
                  </p>
                </div>
              ) : (
                <CreditField
                  id={`credit-band-${i}-upto`}
                  label={`Faixa ${i + 1}: até (R$)`}
                  kind="money"
                  registration={register(`bands.${i}.upTo`, { validate: () => bandCeilingError(getValues(`bands.${i}.upTo`), i > 0 ? getValues(`bands.${i - 1}.upTo`) : undefined) ?? true })}
                  error={rowErrors?.upTo?.message}
                />
              )}

              <CreditField
                id={`credit-band-${i}-installments`}
                label={`Faixa ${i + 1}: máximo de parcelas`}
                kind="int"
                registration={register(`bands.${i}.maxInstallments`, { validate: (v) => intError(v, { min: 1, max: MAX_INSTALLMENTS }) ?? true })}
                error={rowErrors?.maxInstallments?.message}
              />

              {!isLast && fields.length > 1 && (
                <button
                  type="button"
                  aria-label={`Remover faixa ${i + 1}`}
                  onClick={() => remove(i)}
                  className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-input text-danger hover:bg-danger-soft sm:mt-7"
                >
                  <Trash2 size={18} aria-hidden="true" />
                </button>
              )}
            </div>
          );
        })}

        <button
          type="button"
          onClick={() => insert(Math.max(lastIndex, 0), { upTo: '', maxInstallments: '' })}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-input bg-surface px-4 font-medium text-foreground hover:bg-surface-muted sm:w-auto sm:self-start"
        >
          <Plus size={18} aria-hidden="true" />
          Adicionar faixa
        </button>
      </div>
    </fieldset>
  );
}
