import { forwardRef } from 'react';

import { useCan } from '@/shared/auth/useCan';
import { FieldError, PercentInput, fieldA11y, type PercentInputProps } from '@/shared/components/form';

import { TARGET_MARGIN_LABEL } from '../utils/targetMargin';

interface Props extends Omit<PercentInputProps, 'id'> {
  id: string;
  error?: string;
}

/**
 * "Margem desejada (%)" opcional de categoria, produto ou variante. Só aparece para quem tem `pricing.manage`;
 * vazio = usa a margem do nível acima. Use com `register(...)` do react-hook-form.
 */
export const TargetMarginField = forwardRef<HTMLInputElement, Props>(function TargetMarginField({ id, error, ...rest }, ref) {
  const allowed = useCan('pricing.manage');
  if (!allowed) return null;

  return (
    <div>
      <label htmlFor={id} className="mb-1 block">
        {TARGET_MARGIN_LABEL}
      </label>
      <PercentInput {...rest} ref={ref} id={id} {...fieldA11y(id, error)} />
      <p className="mt-1 text-sm text-muted">Opcional. Em branco usa a margem do nível acima (categoria, depois a margem padrão da loja).</p>
      <FieldError id={id} message={error} />
    </div>
  );
});
