import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CrudPagination } from '@/shared/components/crud';
import { Section } from '@/shared/components/details/Section';
import { Page } from '@/shared/components/layout/Page';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { LoadingState } from '@/shared/components/LoadingState';
import { DataTable, type DataTableColumn } from '@/shared/components/table';
import { formatCurrency } from '@/shared/utils/money';
import { notify } from '@/shared/utils/notify';
import type { Tone } from '@/shared/utils/statusTone';

import { useApplyPriceReviews, useDismissPriceReview } from '../hooks/useApplyPrice';
import { usePriceReviews } from '../hooks/usePriceReviews';
import type { PriceReview, PriceReviewReason } from '../types';

const REASONS: Record<PriceReviewReason, { label: string; tone: Tone }> = {
  COST_CHANGED: { label: 'Custo mudou', tone: 'info' },
  SETTINGS_CHANGED: { label: 'Configuração mudou', tone: 'info' },
  MARGIN_CHANGED: { label: 'Margem desejada mudou', tone: 'info' },
  MARGIN_BELOW_TARGET: { label: 'Margem abaixo da desejada', tone: 'warning' },
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const signed = (value: number) => `${value > 0 ? '+' : ''}${formatCurrency(value)}`;
const checkbox = 'h-5 w-5 shrink-0 rounded-lg border-input accent-primary';

export function PriceReviewListPage() {
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const { data, isLoading, isError } = usePriceReviews(page);
  const applyReviews = useApplyPriceReviews();
  const dismiss = useDismissPriceReview();

  const rows = useMemo(() => data?.data ?? [], [data]);
  // A seleção vale só para o que está na página (mudou a página ou saiu da lista: deixa de contar).
  const chosen = useMemo(() => rows.filter((r) => selected.has(r.id)).map((r) => r.id), [rows, selected]);
  const allChosen = rows.length > 0 && chosen.length === rows.length;
  const busy = applyReviews.isPending || dismiss.isPending;

  function toggle(id: string, on: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (on) next.add(id);
      else next.delete(id);

      return next;
    });
  }

  async function apply(ids: string[]) {
    if (ids.length === 0 || busy) return;
    try {
      const { applied, skipped } = await applyReviews.mutateAsync(ids);
      if (applied.length > 0) notify.success(`${plural(applied.length, 'preço aplicado', 'preços aplicados')}.`);
      if (skipped.length > 0) notify.warning(`${plural(skipped.length, 'item ignorado', 'itens ignorados')}: já resolvido, removido da lista ou sem preço sugerido agora.`);
      setSelected(new Set());
    } catch {
      // A mutation já mostrou o erro.
    }
  }

  async function keep(id: string) {
    try {
      await dismiss.mutateAsync(id);
    } catch {
      // A mutation já mostrou o erro.
    }
  }

  const columns: DataTableColumn<PriceReview>[] = [
    {
      id: 'label',
      header: 'Produto',
      mobile: 'title',
      cell: (r) => (
        <label className="flex min-h-11 items-center gap-3 font-medium">
          <input type="checkbox" className={checkbox} checked={selected.has(r.id)} onChange={(e) => toggle(r.id, e.target.checked)} aria-label={`Selecionar ${r.label}`} />
          <span>{r.label}</span>
        </label>
      ),
    },
    { id: 'current', header: 'Preço atual', numeric: true, mobile: 'meta', cell: (r) => formatCurrency(r.currentPrice) },
    { id: 'suggested', header: 'Sugerido', numeric: true, mobile: 'meta', cell: (r) => <span className="font-semibold">{formatCurrency(r.suggestedPrice)}</span> },
    { id: 'difference', header: 'Diferença', numeric: true, mobile: 'meta', cell: (r) => signed(r.difference) },
    {
      id: 'reason',
      header: 'Motivo',
      mobile: 'subtitle',
      cell: (r) => <Badge tone={REASONS[r.reason].tone}>{REASONS[r.reason].label}</Badge>,
    },
    {
      id: 'actions',
      header: <span className="sr-only">Ações</span>,
      align: 'right',
      mobile: 'actions',
      cell: (r) => (
        <div className="flex flex-wrap items-center justify-end gap-2 lg:flex-nowrap">
          <Button type="button" variant="outline" disabled={busy} aria-label={`Aplicar sugerido: ${r.label}`} onClick={() => void apply([r.id])} className="min-h-11 lg:min-h-9">
            Aplicar
          </Button>
          <Button type="button" variant="ghost" disabled={busy} aria-label={`Manter preço: ${r.label}`} onClick={() => void keep(r.id)} className="min-h-11 lg:min-h-9">
            Manter
          </Button>
          <Link
            to={`/variants/${r.productVariantId}/edit`}
            aria-label={`Editar ${r.label}`}
            className="inline-flex min-h-11 items-center rounded-lg px-4 py-2 text-foreground hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:min-h-9"
          >
            Editar
          </Link>
        </div>
      ),
    },
  ];

  return (
    <Page>
      <PageHeader title="Preços para revisar" description="Variantes cujo preço sugerido mudou ou cuja margem ficou abaixo da desejada. Aplique o sugerido, mantenha o preço ou edite." />

      <Section>
        <div className="flex flex-1 flex-col">
          <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <label className="flex min-h-11 items-center gap-3 text-sm font-medium text-foreground">
              <input type="checkbox" className={checkbox} checked={allChosen} disabled={rows.length === 0 || busy} onChange={(e) => setSelected(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set())} aria-label="Selecionar todas" />
              Selecionar todas desta página
            </label>
            <Button type="button" disabled={chosen.length === 0 || busy} onClick={() => void apply(chosen)} className="min-h-11">
              {`Aplicar sugerido (${chosen.length})`}
            </Button>
          </div>

          {isError ? (
            <div role="alert" className="m-4 rounded-lg border border-danger/30 bg-danger-soft p-4 text-sm text-danger sm:m-5">
              Não foi possível carregar os preços para revisar.
            </div>
          ) : isLoading ? (
            <LoadingState label="Carregando preços para revisar..." />
          ) : (
            <div className="flex-1">
              <DataTable data={rows} columns={columns} getRowId={(r) => r.id} emptyMessage="Nenhum preço para revisar" emptyHint="Quando o custo ou a configuração mudar, as variantes afetadas aparecem aqui." />
            </div>
          )}

          <div className="shrink-0">
            <CrudPagination
              page={data?.pagination.page ?? page}
              totalPages={data?.pagination.totalPages ?? 1}
              totalItems={data?.pagination.total ?? 0}
              onPrevious={() => setPage((p) => Math.max(1, p - 1))}
              onNext={() => setPage((p) => Math.min(data?.pagination.totalPages ?? 1, p + 1))}
            />
          </div>
        </div>
      </Section>
    </Page>
  );
}

export default PriceReviewListPage;
