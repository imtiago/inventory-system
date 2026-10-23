import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';

export type AutocompleteProps<TOption, TValue extends string | number> = {
  options: TOption[];
  value: TValue | null;
  onChange: (value: TValue | null, option: TOption | null) => void;

  getOptionValue: (option: TOption) => TValue;
  getOptionLabel: (option: TOption) => string;
  getOptionDescription?: (option: TOption) => string;
  filterOption?: (option: TOption, query: string) => boolean;

  label?: string;
  placeholder?: string;
  emptyMessage?: string;
  minSearchLength?: number;
  disabled?: boolean;
  loading?: boolean;
  error?: string;
  required?: boolean;
  name?: string;
  onSearchChange?: (query: string) => void;
};

export function Autocomplete<TOption, TValue extends string | number>({
  options,
  value,
  onChange,
  getOptionValue,
  getOptionLabel,
  getOptionDescription,
  filterOption,
  label,
  placeholder = 'Pesquisar...',
  emptyMessage = 'Nenhum resultado encontrado.',
  minSearchLength = 0,
  disabled = false,
  loading = false,
  error,
  required = false,
  name,
  onSearchChange,
}: AutocompleteProps<TOption, TValue>) {
  const id = useId();
  const inputId = `${id}-input`;
  const listId = `${id}-list`;
  const containerRef = useRef<HTMLDivElement>(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);

  const selectedOption = options.find((option) => value != null && getOptionValue(option) === value);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    }

    document.addEventListener('mousedown', handleOutsideClick);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, []);

  const filteredOptions = options.filter((option) => {
    if (filterOption) return filterOption(option, query);

    const normalizedQuery = query.trim().toLocaleLowerCase('pt-BR');

    if (!normalizedQuery) return true;

    const optionLabel = getOptionLabel(option).toLocaleLowerCase('pt-BR');
    const description = (getOptionDescription?.(option) ?? '').toLocaleLowerCase('pt-BR');

    return optionLabel.includes(normalizedQuery) || description.includes(normalizedQuery);
  });

  function updateQuery(nextQuery: string) {
    setQuery(nextQuery);
    setActiveIndex(-1);
    onSearchChange?.(nextQuery);
  }

  function selectOption(option: TOption) {
    onChange(getOptionValue(option), option);
    setQuery(getOptionLabel(option));
    onSearchChange?.('');
    setOpen(false);
    setActiveIndex(-1);
  }

  function clearSelection() {
    onChange(null, null);
    updateQuery('');
    setOpen(true);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!open) setQuery('');
      setOpen(true);

      setActiveIndex((current) => Math.min(current + 1, filteredOptions.length - 1));
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();

      setActiveIndex((current) => Math.max(current - 1, 0));
    }

    if (event.key === 'Enter' && open && activeIndex >= 0) {
      event.preventDefault();

      const option = filteredOptions[activeIndex];

      if (option) selectOption(option);
    }

    if (event.key === 'Escape') {
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  const queryTooShort = query.trim().length < minSearchLength;

  return (
    <div ref={containerRef} className="w-full">
      {label && (
        <label htmlFor={inputId} className="mb-2 block text-sm font-medium text-gray-700">
          {label}
          {required && <span className="ml-1 text-red-500">*</span>}
        </label>
      )}

      <div className="relative">
        <Search size={18} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />

        <input
          id={inputId}
          name={name}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={open && activeIndex >= 0 ? `${listId}-option-${activeIndex}` : undefined}
          aria-invalid={Boolean(error)}
          aria-required={required}
          autoComplete="off"
          disabled={disabled}
          value={open ? query : selectedOption ? getOptionLabel(selectedOption) : ''}
          placeholder={placeholder}
          onFocus={() => {
            setQuery('');
            onSearchChange?.('');
            setOpen(true);
            setActiveIndex(-1);
          }}
          onChange={(event) => {
            updateQuery(event.target.value);
            setOpen(true);
          }}
          onKeyDown={handleKeyDown}
          className={`w-full rounded-lg border bg-white py-2.5 pl-10 pr-20 text-sm outline-none focus:ring-2 disabled:cursor-not-allowed disabled:bg-gray-100 ${
            error ? 'border-red-500 focus:border-red-500 focus:ring-red-100' : 'border-gray-200 focus:border-blue-500 focus:ring-blue-100'
          }`}
        />

        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
          {value != null && !disabled && (
            <button type="button" aria-label="Limpar seleção" onClick={clearSelection} className="rounded p-1 text-gray-400 hover:bg-gray-100">
              <X size={15} />
            </button>
          )}

          <button
            type="button"
            tabIndex={-1}
            disabled={disabled}
            aria-label={open ? 'Fechar opções' : 'Mostrar opções'}
            onClick={() => {
              if (!open) {
                setQuery('');
                onSearchChange?.('');
              }

              setOpen((current) => !current);
              setActiveIndex(-1);
            }}
            className="rounded p-1 text-gray-400 hover:bg-gray-100"
          >
            <ChevronDown size={17} className={open ? 'rotate-180 transition-transform' : 'transition-transform'} />
          </button>
        </div>

        {open && !disabled && (
          <ul id={listId} role="listbox" className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
            {queryTooShort ? (
              <li className="px-3 py-4 text-sm text-gray-500">Digite pelo menos {minSearchLength} caracteres para pesquisar.</li>
            ) : loading ? (
              <li className="px-3 py-4 text-sm text-gray-500">Buscando resultados...</li>
            ) : filteredOptions.length === 0 ? (
              <li className="px-3 py-4 text-sm text-gray-500">{emptyMessage}</li>
            ) : (
              filteredOptions.map((option, index) => {
                const optionValue = getOptionValue(option);
                const selected = value != null && optionValue === value;
                const description = getOptionDescription?.(option);

                return (
                  <li key={String(optionValue)} id={`${listId}-option-${index}`} role="option" aria-selected={selected}>
                    <button
                      type="button"
                      onMouseEnter={() => setActiveIndex(index)}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => selectOption(option)}
                      className={`flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left ${activeIndex === index ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-gray-900">{getOptionLabel(option)}</span>

                        {description && <span className="mt-0.5 block truncate text-xs text-gray-500">{description}</span>}
                      </span>

                      {selected && <Check size={16} className="shrink-0 text-blue-600" />}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-1.5 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
