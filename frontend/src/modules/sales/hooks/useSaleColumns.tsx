import { Link } from 'react-router-dom';

import type { DataTableColumn } from '@/shared/components/table';
import { StatusBadge } from '@/components/ui/badge';

import { formatCurrency } from '@/shared/utils/money';

import type { ISale } from '../types';

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

const statusLabels: Record<string, string> = {
  COMPLETED: 'Concluída',
  PENDING: 'Pendente',
  CANCELED: 'Cancelada',
};

export function useSaleColumns(): DataTableColumn<ISale>[] {
  return [
    {
      id: 'sale',
      header: 'Venda',
      mobile: 'title',
      cell: (sale) => (
        <div>
          <Link to={`/sales/${sale.id}`} className="font-medium hover:underline">
            #{sale.id.slice(0, 8).toUpperCase()}
          </Link>

          <div className="text-sm text-muted">{formatDate(sale.createdAt)}</div>
        </div>
      ),
    },
    {
      id: 'customer',
      header: 'Cliente',
      mobile: 'subtitle',
      cell: (sale) => sale.customer?.name ?? 'Cliente não identificado',
    },
    {
      id: 'items',
      header: 'Itens',
      mobile: 'meta',
      numeric: true,
      cell: (sale) => sale.itemsCount,
    },
    {
      id: 'totalAmount',
      header: 'Valor total',
      mobile: 'meta',
      numeric: true,
      cell: (sale) => formatCurrency(sale.totalAmount),
    },
    {
      id: 'status',
      header: 'Status',
      mobile: 'meta',
      cell: (sale) => <StatusBadge status={sale.status}>{statusLabels[sale.status] ?? sale.status}</StatusBadge>,
    },
  ];
}
