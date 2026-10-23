import { useState } from 'react';

import { Autocomplete } from '@/shared/components/form';
import { useCustomer } from '@/modules/customers/hooks/useCustomer';
import { useCustomerSearch } from '@/modules/customers/hooks/useCustomerSearch';
import type { ICustomer } from '@/modules/customers/types';
import { useSupplier, useSupplierSearch } from '@/modules/suppliers/hooks/useSuppliers';
import type { ISupplier } from '@/modules/suppliers/types';

import { FINANCE_KINDS, type FinanceKind } from '../config';

interface Props {
  kind: FinanceKind;
  value: string | undefined;
  onChange: (value: string | null) => void;
}

interface Party {
  id: string;
  name: string;
  description: string;
}

function usePartyOptions(kind: FinanceKind, value: string | undefined, search: string) {
  const isCustomer = kind === 'receivable';
  // Both lookups are declared unconditionally; only the one for this kind is enabled.
  const customer = useCustomer(isCustomer ? (value ?? '') : '');
  const supplier = useSupplier(isCustomer ? '' : (value ?? ''));
  const customers = useCustomerSearch(isCustomer ? search : '');
  const suppliers = useSupplierSearch(isCustomer ? '' : search);

  const toParty = (c: ICustomer): Party => ({ id: c.id, name: c.name, description: [c.email, c.phone].filter(Boolean).join(' · ') });
  const toSupplierParty = (s: ISupplier): Party => ({ id: s.id, name: s.name, description: [s.email, s.phone].filter(Boolean).join(' · ') });

  return {
    options: isCustomer ? (customers.data?.data ?? []).map(toParty) : (suppliers.data?.data ?? []).map(toSupplierParty),
    fromUrl: isCustomer ? (customer.data ? toParty(customer.data) : null) : supplier.data ? toSupplierParty(supplier.data) : null,
    loading: isCustomer ? customers.isFetching : suppliers.isFetching,
  };
}

/** Customer (receivables) or supplier (payables) autocomplete filter. */
export function PartyFilter({ kind, value, onChange }: Props) {
  const config = FINANCE_KINDS[kind];
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Party | null>(null);
  const { options, fromUrl, loading } = usePartyOptions(kind, value, search);

  const known = selected?.id === value ? selected : fromUrl?.id === value ? fromUrl : null;
  const merged = known && !options.some((o) => o.id === known.id) ? [known, ...options] : options;

  return (
    <Autocomplete<Party, string>
      label={config.partyLabel}
      placeholder={config.partyPlaceholder}
      options={merged}
      value={value ?? null}
      getOptionValue={(party) => party.id}
      getOptionLabel={(party) => party.name}
      getOptionDescription={(party) => party.description}
      onSearchChange={setSearch}
      onChange={(next, option) => {
        setSelected(option);
        onChange(next);
      }}
      minSearchLength={2}
      loading={loading}
      emptyMessage={config.partyEmpty}
    />
  );
}
