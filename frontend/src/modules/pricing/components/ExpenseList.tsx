import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { Section } from '@/shared/components/details/Section';
import { DataTable, type DataTableColumn } from '@/shared/components/table';
import { formatBps } from '@/shared/utils/percent';

import { useCreateExpense, useDeleteExpense, useUpdateExpense } from '../hooks/usePricingMutations';
import type { PricingExpense } from '../types';
import { ExpenseHelperModal } from './ExpenseHelperModal';

interface Props {
  expenses: PricingExpense[];
  totalPercent: number;
}

/** Despesas da venda (aluguel, taxas…): cada uma é um percentual do preço; só as ativas entram no cálculo. */
export function ExpenseList({ expenses, totalPercent }: Props) {
  const [editing, setEditing] = useState<PricingExpense | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<PricingExpense | null>(null);
  const create = useCreateExpense();
  const update = useUpdateExpense();
  const remove = useDeleteExpense();

  const columns: DataTableColumn<PricingExpense>[] = [
    { id: 'name', header: 'Despesa', mobile: 'title', cell: (e) => e.name },
    { id: 'percent', header: 'Percentual', mobile: 'meta', numeric: true, cell: (e) => formatBps(Math.round(e.percent * 100)) },
    { id: 'active', header: 'Situação', mobile: 'meta', cell: (e) => <Badge tone={e.active ? 'success' : 'neutral'}>{e.active ? 'Ativa' : 'Inativa'}</Badge> },
    {
      id: 'actions',
      header: 'Ações',
      mobile: 'actions',
      align: 'center',
      cell: (e) => (
        <div className="flex justify-center gap-1">
          <button
            type="button"
            onClick={() => {
              setEditing(e);
              setFormOpen(true);
            }}
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-primary hover:bg-surface-muted"
            aria-label={`Editar ${e.name}`}
          >
            <Pencil size={18} />
          </button>
          <button type="button" onClick={() => setDeleting(e)} className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-danger hover:bg-surface-muted" aria-label={`Excluir ${e.name}`}>
            <Trash2 size={18} />
          </button>
        </div>
      ),
    },
  ];

  function close() {
    setFormOpen(false);
    setEditing(null);
  }

  return (
    <Section
      title="Despesas da venda"
      description="Percentuais que saem de cada venda (aluguel, impostos, comissão…)."
      actions={
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary-hover"
        >
          <Plus size={18} aria-hidden="true" />
          Nova despesa
        </button>
      }
    >
      <DataTable data={expenses} columns={columns} getRowId={(e) => e.id} emptyMessage="Nenhuma despesa cadastrada" emptyHint="Sem despesas, o preço sugerido considera só a margem." />

      <p className="border-t border-border px-4 py-3 text-sm text-muted sm:px-6">
        Total das despesas ativas: <strong className="text-foreground">{formatBps(Math.round(totalPercent * 100))}</strong>
      </p>

      <ExpenseHelperModal
        open={formOpen}
        expense={editing}
        onClose={close}
        onSave={async (input) => {
          if (editing) await update.mutateAsync({ id: editing.id, input });
          else await create.mutateAsync(input);
          close();
        }}
      />

      <ConfirmDialog
        open={deleting !== null}
        title="Excluir despesa"
        description={`Deseja realmente excluir "${deleting?.name ?? ''}"? Os preços sugeridos serão recalculados.`}
        loading={remove.isPending}
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await remove.mutateAsync(deleting.id);
          } catch {
            // O toast de erro já foi mostrado.
          }
          setDeleting(null);
        }}
        onCancel={() => setDeleting(null)}
      />
    </Section>
  );
}
