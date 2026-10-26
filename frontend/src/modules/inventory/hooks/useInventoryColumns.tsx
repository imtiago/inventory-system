import { Link } from 'react-router-dom';

import type { DataTableColumn } from '@/shared/components/table';
import { StatusBadge } from '@/components/ui/badge';

import type { IInventory } from '../types';

type InventoryStatusCode = 'OUT_OF_STOCK' | 'RESERVED' | 'AVAILABLE';

const INVENTORY_STATUS_LABELS = { OUT_OF_STOCK: 'Sem estoque', RESERVED: 'Reservado', AVAILABLE: 'Disponível' } as const;

/** Computed from real quantities: no stock wins over reserved. The code keys the shared `statusTone` map. */
export function inventoryStatusCode(item: Pick<IInventory, 'availableQuantity' | 'reservedQuantity'>): InventoryStatusCode {
  if (item.availableQuantity <= 0) return 'OUT_OF_STOCK';
  if (item.reservedQuantity > 0) return 'RESERVED';

  return 'AVAILABLE';
}

export function inventoryStatus(item: Pick<IInventory, 'availableQuantity' | 'reservedQuantity'>): (typeof INVENTORY_STATUS_LABELS)[InventoryStatusCode] {
  return INVENTORY_STATUS_LABELS[inventoryStatusCode(item)];
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
      numeric: true,

      cell: (data) => (
        <div className="flex flex-col items-end gap-1">
          <span>{data.quantity}</span>
          {data.expired > 0 && <span className="text-xs font-medium text-danger">Vencido: {data.expired}</span>}
        </div>
      ),
    },
    {
      id: 'availableQuantity',
      header: 'Disponível',
      mobile: 'meta',
      numeric: true,

      cell: (data) => data.availableQuantity,
    },
    {
      id: 'status',
      header: 'Status',
      mobile: 'meta',

      cell: (data) => <StatusBadge status={inventoryStatusCode(data)}>{inventoryStatus(data)}</StatusBadge>,
    },
  ];
}
