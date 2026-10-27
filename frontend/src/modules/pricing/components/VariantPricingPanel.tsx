import { useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Section } from '@/shared/components/details/Section';
import { FieldError, MoneyInput, fieldA11y } from '@/shared/components/form';
import { LoadingState } from '@/shared/components/LoadingState';
import { formatDateTime } from '@/shared/utils/formatDateTime';
import { formatCurrency, moneyTextError, parseMoneyToCents } from '@/shared/utils/money';
import { formatPercent } from '@/modules/reports/utils/formatPercent';

import { useApplyPrice, useSetSupplierPrice } from '../hooks/useApplyPrice';
import { useVariantPricing } from '../hooks/useVariantPricing';
import type { PriceMargin } from '../types';
import { MARGIN_SOURCE_LABEL, formatCost } from '../utils/format';
import { PaymentSimulator } from './PaymentSimulator';

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="min-w-0 rounded-lg border border-border p-3">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="mt-1 break-words text-lg font-semibold tabular-nums text-foreground">{children}</dd>
      {hint && <dd className="text-xs text-muted">{hint}</dd>}
    </div>
  );
}

const money = (m: PriceMargin) => (
  <span className={m.amount < 0 ? 'text-danger' : undefined}>
    {formatCurrency(m.amount)} <span className="text-base font-medium">({formatPercent(m.percent)})</span>
  </span>
);

/** Composição do preço de uma variante, ações de preço e simulador. Só renderize para quem tem `catalog.price`. */
export function VariantPricingPanel({ variantId }: { variantId: string }) {
  const { data, isLoading, isError } = useVariantPricing(variantId);
  const apply = useApplyPrice(variantId);
  const saveSupplier = useSetSupplierPrice(variantId);
  const [supplierText, setSupplierText] = useState('');

  if (isLoading) return <LoadingState label="Carregando composição do preço..." compact />;
  if (isError || !data) {
    return (
      <p role="alert" className="rounded-xl border border-danger/30 bg-danger-soft p-4 text-sm text-danger">
        Não foi possível carregar a composição do preço.
      </p>
    );
  }

  const supplierCents = parseMoneyToCents(supplierText);
  const supplierError = !supplierText.trim() ? null : moneyTextError(supplierText) ?? (supplierCents !== null && supplierCents <= 0 ? 'O preço da revista deve ser maior que zero' : null);
  const canSaveSupplier = supplierText.trim() !== '' && !supplierError && supplierCents !== null;
  const busy = apply.isPending || saveSupplier.isPending;

  async function submitSupplier(price: number | null) {
    try {
      await saveSupplier.mutateAsync(price);
      setSupplierText('');
    } catch {
      // A mutation já mostrou o erro.
    }
  }

  async function applySource(source: 'SUGGESTED' | 'SUPPLIER') {
    try {
      await apply.mutateAsync(source);
    } catch {
      // A mutation já mostrou o erro.
    }
  }

  return (
    <Section title="Composição do preço" description="Como o preço de venda é formado a partir do custo médio, das despesas e da margem desejada.">
      <div className="flex flex-col gap-6 p-4 sm:p-5">
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Custo médio">{formatCost(data.averageCost)}</Field>
          <Field label="Despesas da venda">
            {formatCurrency(data.expensesAmount)} <span className="text-base font-medium">({formatPercent(data.expensesPercent)})</span>
          </Field>
          <Field label="Margem desejada" hint={MARGIN_SOURCE_LABEL[data.targetMarginSource]}>
            {formatPercent(data.targetMarginPercent)}
          </Field>
          <Field label="Preço sugerido" hint={data.suggestedPrice === null ? 'Sem custo ou sem configuração de preços' : undefined}>
            {data.suggestedPrice === null ? '—' : formatCurrency(data.suggestedPrice)}
          </Field>
          <Field label="Preço praticado">{formatCurrency(data.salePrice)}</Field>
          <Field label="Margem real">{money(data.realMargin)}</Field>
          <Field label="Preço da revista" hint={data.supplierSuggestedPriceUpdatedAt ? `Atualizado em ${formatDateTime(data.supplierSuggestedPriceUpdatedAt)}` : undefined}>
            {data.supplierSuggestedPrice === null ? '—' : formatCurrency(data.supplierSuggestedPrice)}
          </Field>
          <Field label="Margem pela revista">{data.supplierMargin ? money(data.supplierMargin) : '—'}</Field>
        </dl>

        <div className="flex flex-wrap gap-3">
          <Button type="button" onClick={() => applySource('SUGGESTED')} disabled={busy || data.suggestedPrice === null} className="min-h-11">
            Aplicar sugerido
          </Button>
          <Button type="button" variant="outline" onClick={() => applySource('SUPPLIER')} disabled={busy || data.supplierSuggestedPrice === null} className="min-h-11">
            Usar preço da revista
          </Button>
        </div>

        <form
          className="flex flex-col gap-2"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            if (canSaveSupplier && supplierCents !== null && !busy) void submitSupplier(supplierCents / 100);
          }}
        >
          <label htmlFor="supplier-price" className="text-sm font-medium text-foreground">
            Novo preço da revista
          </label>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
            <div className="sm:w-56">
              <MoneyInput id="supplier-price" value={supplierText} onChange={(e) => setSupplierText(e.target.value)} {...fieldA11y('supplier-price', supplierError ?? undefined)} />
              <FieldError id="supplier-price" message={supplierError ?? undefined} />
            </div>
            <Button type="submit" variant="secondary" disabled={busy || !canSaveSupplier} className="min-h-11">
              Salvar preço da revista
            </Button>
            {data.supplierSuggestedPrice !== null && (
              <Button type="button" variant="ghost" disabled={busy} onClick={() => void submitSupplier(null)} className="min-h-11">
                Remover preço da revista
              </Button>
            )}
          </div>
        </form>

        <PaymentSimulator simulations={data.simulations} salePrice={data.salePrice} />
      </div>
    </Section>
  );
}
