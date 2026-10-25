import { Link } from 'react-router-dom';

import type { DataTableColumn } from '@/shared/components/table';
import { CrudBadge } from '@/shared/components/crud';

import type { IInventory } from '../types';

/** Computed from real quantities: no stock wins over reserved. */
export function inventoryStatus(item: Pick<IInventory, 'availableQuantity' | 'reservedQuantity'>): 'Sem estoque' | 'Reservado' | 'Disponível' {
  if (item.availableQuantity <= 0) return 'Sem estoque';
  if (item.reservedQuantity > 0) return 'Reservado';

  return 'Disponível';
}

export function useInventoryColumns(): DataTableColumn<IInventory>[] {
  return [
    {
      id: 'code',
      header: 'Código',

      cell: (data) => (
        <Link to={`/inventory/${data.id}`} className="font-medium hover:underline">
          {data.productVariant.code}
        </Link>
      ),
    },
    {
      id: 'product',
      header: 'Produto / Variante',

      cell: (data) => data.productVariant.name,
    },
    {
      id: 'quantity',
      header: 'Estoque',

      cell: (data) => <CrudBadge>{data.quantity}</CrudBadge>,
    },
    {
      id: 'availableQuantity',
      header: 'Disponível',

      cell: (data) => <CrudBadge>{data.availableQuantity}</CrudBadge>,
    },
    {
      id: 'status',
      header: 'Status',

      cell: (data) => <CrudBadge>{inventoryStatus(data)}</CrudBadge>,
    },
  ];
}
