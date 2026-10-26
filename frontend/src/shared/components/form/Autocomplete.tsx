import { useEffect, useId, useRef, useState } from 'react';

import { useFinePointer } from '@/shared/hooks/useMediaQuery';
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
  /** Accessible name when no visible `label` is rendered. */
  ariaLabel?: string;
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
  ariaLabel,
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
  const finePointer = useFinePointer();

  /** Em toque, leva o campo ao topo da área visível para a lista não ficar sob o teclado. */
  function revealAboveKeyboard() {
    if (finePointer) return;
    window.setTimeout(() => containerRef.current?.scrollIntoView?.({ block: 'start', behavior: 'smooth' }), 300);
  }

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
      // Handled locally: an enclosing dialog must not also close.
      if (open) event.preventDefault();
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  const queryTooShort = query.trim().length < minSearchLength;

  return (
    <div ref={containerRef} className="w-full">
      {label && (
        <label htmlFor={inputId} className="mb-2 block text-sm font-medium text-foreground">
          {label}
          {required && <span className="ml-1 text-danger">*</span>}
        </label>
      )}

      <div className="relative">
        <Search size={18} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />

        <input
          id={inputId}
          name={name}
          aria-label={label ? undefined : ariaLabel}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={open && activeIndex >= 0 ? `${listId}-option-${activeIndex}` : undefined}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${inputId}-error` : undefined}
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
            revealAboveKeyboard();
          }}
          onChange={(event) => {
            updateQuery(event.target.value);
            setOpen(true);
          }}
          onKeyDown={handleKeyDown}
          className={`h-11 w-full rounded-lg border bg-surface pl-10 ${value != null && !disabled ? 'pr-[4.75rem]' : 'pr-10'} text-base text-foreground outline-none sm:text-sm focus:ring-2 disabled:cursor-not-allowed disabled:bg-surface-muted ${
            error ? 'border-danger focus:border-danger focus:ring-danger/20' : 'border-input focus:border-ring focus:ring-ring/20'
          }`}
        />

        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
          {value != null && !disabled && (
            <button type="button" aria-label="Limpar seleção" onClick={clearSelection} className="rounded-lg p-1 text-subtle hover:bg-surface-muted">
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
            className="rounded-lg p-1 text-subtle hover:bg-surface-muted"
          >
            <ChevronDown size={17} className={open ? 'rotate-180 transition-transform' : 'transition-transform'} />
          </button>
        </div>

        {open && !disabled && (
          <ul id={listId} role="listbox" className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-border bg-surface py-1 shadow-lg">
            {queryTooShort ? (
              <li className="px-3 py-4 text-sm text-muted">Digite pelo menos {minSearchLength} caracteres para pesquisar.</li>
            ) : loading ? (
              <li className="px-3 py-4 text-sm text-muted">Buscando resultados...</li>
            ) : filteredOptions.length === 0 ? (
              <li className="px-3 py-4 text-sm text-muted">{emptyMessage}</li>
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
                      className={`flex min-h-11 w-full items-center justify-between gap-3 px-3 py-2.5 text-left ${activeIndex === index ? 'bg-primary/10' : 'hover:bg-surface-muted'}`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-foreground">{getOptionLabel(option)}</span>

                        {description && <span className="mt-0.5 block truncate text-xs text-muted">{description}</span>}
                      </span>

                      {selected && <Check size={16} className="shrink-0 text-primary" />}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        )}
      </div>

      {error && (
        <p id={`${inputId}-error`} role="alert" className="mt-1.5 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
