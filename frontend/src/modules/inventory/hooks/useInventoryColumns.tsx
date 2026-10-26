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
      mobile: 'title',

      cell: (data) => (
        <Link to={`/inventory/${data.id}`} className="font-medium hover:underline">
          {data.productVariant.code}
        </Link>
      ),
    },
    {
      id: 'product',
      header: 'Produto / Variante',
      mobile: 'subtitle',

      cell: (data) => data.productVariant.name,
    },
    {
      id: 'quantity',
      header: 'Estoque',
      mobile: 'meta',

      cell: (data) => (
        <div className="flex flex-col items-start gap-1">
          <CrudBadge>{data.quantity}</CrudBadge>
          {data.expired > 0 && <span className="text-xs font-medium text-red-600">Vencido: {data.expired}</span>}
        </div>
      ),
    },
    {
      id: 'availableQuantity',
      header: 'Disponível',
      mobile: 'meta',

      cell: (data) => <CrudBadge>{data.availableQuantity}</CrudBadge>,
    },
    {
      id: 'status',
      header: 'Status',
      mobile: 'meta',

      cell: (data) => <CrudBadge>{inventoryStatus(data)}</CrudBadge>,
    },
  ];
}
