import { useState } from 'react';

import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';

import { Autocomplete } from './Autocomplete';

/** Page size of the server-side searched options (brand/category pickers). */
export const SEARCH_OPTIONS_LIMIT = 20;

interface NamedOption {
  id: string;
  name: string;
}

interface Props<T extends NamedOption> {
  /** Query hook returning the options that match `search` (server-side, first SEARCH_OPTIONS_LIMIT). */
  useOptions: (search: string, limit: number) => { data?: T[]; isFetching: boolean; isError: boolean };
  /** Selected id ('' = none). */
  value: string;
  onChange: (id: string) => void;
  /** Entity of the current value, so its name shows even when it is not in the searched page. */
  current?: T | null;
  label?: string;
  ariaLabel?: string;
  placeholder?: string;
  error?: string;
}

/** Autocomplete over a server-searched list (debounced 300 ms); keeps the selected item's name visible. */
export function EntitySearchSelect<T extends NamedOption>({ useOptions, value, onChange, current, label, ariaLabel, placeholder, error }: Props<T>) {
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<T | null>(null);
  const debounced = useDebouncedValue(search.trim(), 300);

  const { data = [], isFetching, isError } = useOptions(debounced, SEARCH_OPTIONS_LIMIT);

  const selected = [picked, current].find((item) => item && item.id === value) ?? null;
  const options = selected && !data.some((item) => item.id === selected.id) ? [selected, ...data] : data;

  return (
    <Autocomplete<T, string>
      options={options}
      value={value || null}
      onChange={(id, option) => {
        setPicked(option);
        onChange(id ?? '');
      }}
      getOptionValue={(option) => option.id}
      getOptionLabel={(option) => option.name}
      // The server already filtered; the selected item (injected) only stays while it matches what is typed.
      filterOption={(option, query) => data.some((item) => item.id === option.id) || !query.trim() || option.name.toLocaleLowerCase('pt-BR').includes(query.trim().toLocaleLowerCase('pt-BR'))}
      onSearchChange={setSearch}
      label={label}
      ariaLabel={ariaLabel}
      placeholder={placeholder}
      loading={isFetching}
      error={error ?? (isError ? 'Não foi possível carregar as opções.' : undefined)}
    />
  );
}
