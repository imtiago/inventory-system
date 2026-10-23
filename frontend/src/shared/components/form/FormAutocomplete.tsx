import { Controller } from 'react-hook-form';
import type { Control, FieldPath, FieldValues, RegisterOptions } from 'react-hook-form';

import { Autocomplete, type AutocompleteProps } from './Autocomplete';

type FormAutocompleteProps<TForm extends FieldValues, TOption, TValue extends string | number, TName extends FieldPath<TForm>> = Omit<
  AutocompleteProps<TOption, TValue>,
  'value' | 'onChange' | 'error' | 'name'
> & {
  control: Control<TForm>;
  name: TName;
  rules?: RegisterOptions<TForm, TName>;
  onOptionChange?: (option: TOption | null) => void;
};

export function FormAutocomplete<TForm extends FieldValues, TOption, TValue extends string | number, TName extends FieldPath<TForm>>({
  control,
  name,
  rules,
  onOptionChange,
  ...props
}: FormAutocompleteProps<TForm, TOption, TValue, TName>) {
  return (
    <Controller
      control={control}
      name={name}
      rules={rules}
      render={({ field, fieldState }) => (
        <Autocomplete<TOption, TValue>
          {...props}
          name={field.name}
          value={(field.value ?? null) as TValue | null}
          onChange={(value, option) => {
            field.onChange(value ?? '');
            onOptionChange?.(option);
          }}
          error={fieldState.error?.message}
        />
      )}
    />
  );
}
