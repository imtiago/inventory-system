import { useState } from 'react';

import { Autocomplete } from '@/shared/components/form';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';
import { useProducts } from '@/modules/products/hooks/useProducts';
import type { Product } from '@/modules/products/types';

interface Props {
  /** Used in the accessible label: "Buscar produto do item N". */
  itemIndex: number;
  value: string | null;
  onChange: (product: Product | null) => void;
}

/** Server-side product search (name, code or barcode of any variant). */
export function ProductPicker({ itemIndex, value, onChange }: Props) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Product | null>(null);
  const debounced = useDebouncedValue(query.trim(), 300);
  const { data, isFetching } = useProducts({ page: 1, limit: 20, search: debounced.length >= 2 ? debounced : undefined });

  const found = debounced.length >= 2 ? (data?.data ?? []) : [];
  const options = selected && !found.some((product) => product.id === selected.id) ? [selected, ...found] : found;

  return (
    <Autocomplete<Product, string>
      label={`Buscar produto do item ${itemIndex}`}
      placeholder="Nome, código ou código de barras..."
      options={options}
      value={value}
      getOptionValue={(product) => product.id}
      getOptionLabel={(product) => product.name}
      getOptionDescription={(product) => `${product.code} · ${product.brand.name}`}
      filterOption={() => true}
      onSearchChange={setQuery}
      onChange={(_id, product) => {
        setSelected(product);
        onChange(product);
      }}
      minSearchLength={2}
      loading={isFetching}
      emptyMessage="Nenhum produto encontrado."
    />
  );
}
