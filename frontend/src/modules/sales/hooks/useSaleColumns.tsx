import { Link } from 'react-router-dom';

import type { DataTableColumn } from '@/shared/components/table';
import { CrudBadge } from '@/shared/components/crud';

import type { ISale } from '../types';

function formatCurrency(value: string | number | null) {
  if (value === null || value === '') {
    return '—';
  }

  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return '—';
  }

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(amount);
}

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

const statusConfig: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' | 'default' }> = {
  COMPLETED: { label: 'Concluída', variant: 'success' },
  PENDING: { label: 'Pendente', variant: 'warning' },
  CANCELLED: { label: 'Cancelada', variant: 'danger' },
};

export function useSaleColumns(): DataTableColumn<ISale>[] {
  return [
    {
      id: 'sale',
      header: 'Venda',
      cell: (sale) => (
        <div>
          <Link to={`/sales/${sale.id}`} className="font-medium hover:underline">
            #{sale.id.slice(0, 8).toUpperCase()}
          </Link>

          <div className="text-sm text-gray-500">{formatDate(sale.createdAt)}</div>
        </div>
      ),
    },
    {
      id: 'customer',
      header: 'Cliente',
      cell: (sale) => sale.customer?.name ?? 'Cliente não identificado',
    },
    {
      id: 'items',
      header: 'Itens',
      align: 'center',
      cell: (sale) => sale.items?.reduce((total, item) => total + item.quantity, 0) ?? 0,
    },
    {
      id: 'totalAmount',
      header: 'Valor total',
      align: 'center',
      cell: (sale) => formatCurrency(sale.totalAmount),
    },
    {
      id: 'status',
      header: 'Status',
      align: 'center',
      cell: (sale) => {
        const config = statusConfig[sale.status] ?? {
          label: sale.status,
          variant: 'default' as const,
        };

        return <CrudBadge>{config.label}</CrudBadge>;
      },
    },
  ];
}
