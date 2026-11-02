import { useState } from 'react';

import { Modal } from '@/shared/components/Modal/Modal';
import { MoneyInput } from '@/shared/components/form';
import { parseApiErrorSync } from '@/shared/services/parseApiError';
import { todayInBusinessTz } from '@/shared/utils/businessDate';
import { formatCents, fromCents, parseMoneyToCents, toCents } from '@/shared/utils/money';

import { useSplitParcel } from '../hooks/useSplitParcel';
import type { IFinanceParcel } from '../types';
import { addMonthsToDateOnly, MAX_SPLIT_PARCELS, suggestSplit, type ISplitRow } from '../utils/splitParcels';

interface Props {
  documentId: string;
  parcel: IFinanceParcel;
  onClose: () => void;
}

const dateClass = 'w-full min-h-11 rounded-lg border border-input bg-surface px-3 py-2.5 text-base text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 sm:text-sm';
const dateClassCompact = dateClass.replace('px-3', 'px-2 sm:px-3');
const labelClass = 'mb-1 block text-sm font-medium text-foreground';

/** Divide o saldo de uma parcela "a combinar" em parcelas com data: sugestão automática, tudo editável. */
export function SplitParcelModal({ documentId, parcel, onClose }: Props) {
  const mutation = useSplitParcel(documentId);
  const totalCents = toCents(parcel.remainingAmount);
  const [countText, setCountText] = useState('1');
  const [firstDate, setFirstDate] = useState(() => addMonthsToDateOnly(todayInBusinessTz(), 1));
  const [rows, setRows] = useState<ISplitRow[]>(() => suggestSplit(totalCents, 1, addMonthsToDateOnly(todayInBusinessTz(), 1)));
  const [serverError, setServerError] = useState<string | null>(null);

  const count = Number(countText);
  const countValid = Number.isInteger(count) && count >= 1 && count <= MAX_SPLIT_PARCELS;
  const amounts = rows.map((row) => parseMoneyToCents(row.amount));
  const sumCents = amounts.reduce<number>((sum, cents) => sum + (cents ?? 0), 0);
  const diff = totalCents - sumCents;
  const rowsValid = rows.length > 0 && rows.every((row, i) => (amounts[i] ?? 0) > 0 && row.dueDate !== '');
  const canSubmit = countValid && rowsValid && diff === 0 && !mutation.isPending;

  function regenerate(nextCount: string, nextDate: string) {
    const n = Number(nextCount);

    if (Number.isInteger(n) && n >= 1 && n <= MAX_SPLIT_PARCELS) setRows(suggestSplit(totalCents, n, nextDate));
  }

  function updateRow(index: number, patch: Partial<ISplitRow>) {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function close() {
    if (mutation.isPending) return;
    onClose();
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    setServerError(null);

    try {
      await mutation.mutateAsync({
        parcelId: parcel.id,
        input: { parcels: rows.map((row, i) => ({ dueDate: row.dueDate, amount: fromCents(amounts[i] ?? 0) })) },
      });
      onClose();
    } catch (error) {
      setServerError(parseApiErrorSync(error).message || 'Não foi possível parcelar o saldo.');
    }
  }

  const sumText = diff === 0 ? `Soma confere: ${formatCents(sumCents)}` : diff > 0 ? `Faltam ${formatCents(diff)} para fechar o saldo` : `Passou ${formatCents(-diff)} do saldo`;

  return (
    <Modal open onClose={close} busy={mutation.isPending} title="Parcelar saldo" description={`Saldo a parcelar: ${formatCents(totalCents)}. A soma das parcelas deve ser igual ao saldo.`} size="lg">
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="split-count" className={labelClass}>
              Número de parcelas
            </label>
            <input
              id="split-count"
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_SPLIT_PARCELS}
              value={countText}
              onChange={(e) => {
                setCountText(e.target.value);
                regenerate(e.target.value, firstDate);
              }}
              aria-invalid={!countValid}
              className={dateClass}
            />
          </div>
          <div>
            <label htmlFor="split-first-date" className={labelClass}>
              Primeiro vencimento
            </label>
            <input
              id="split-first-date"
              type="date"
              value={firstDate}
              onChange={(e) => {
                setFirstDate(e.target.value);
                regenerate(countText, e.target.value);
              }}
              className={dateClassCompact}
            />
          </div>
        </div>
        <p className="text-xs text-muted">Mudar o número ou o primeiro vencimento refaz a sugestão (valores iguais, vencimentos mensais). Depois, ajuste cada parcela se precisar.</p>
        {!countValid && (
          <p role="alert" className="text-sm text-danger">
            Informe de 1 a {MAX_SPLIT_PARCELS} parcelas.
          </p>
        )}

        <ol className="flex flex-col gap-3">
          {rows.map((row, i) => (
            <li key={i} className="grid grid-cols-2 gap-x-2 gap-y-1 sm:gap-x-3">
              <span className="col-span-2 text-xs font-medium text-muted">Parcela {i + 1}</span>
              <div>
                <label htmlFor={`split-amount-${i}`} className="sr-only">
                  Valor da parcela {i + 1}
                </label>
                <MoneyInput id={`split-amount-${i}`} value={row.amount} onChange={(e) => updateRow(i, { amount: e.target.value })} aria-invalid={amounts[i] === null || (amounts[i] ?? 0) <= 0} />
              </div>
              <div>
                <label htmlFor={`split-date-${i}`} className="sr-only">
                  Vencimento da parcela {i + 1}
                </label>
                <input id={`split-date-${i}`} type="date" value={row.dueDate} onChange={(e) => updateRow(i, { dueDate: e.target.value })} className={dateClassCompact} />
              </div>
            </li>
          ))}
        </ol>

        <p data-testid="split-sum" role="status" className={`rounded-lg border p-3 text-sm font-medium ${diff === 0 ? 'border-success/30 bg-success-soft text-success' : 'border-warning/30 bg-warning-soft text-warning'}`}>
          {sumText}
        </p>

        {serverError && (
          <div role="alert" className="rounded-lg border border-danger/30 p-3 text-sm text-danger">
            {serverError}
          </div>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className="min-h-11 rounded-lg border px-4 py-2 hover:bg-surface-muted disabled:opacity-50" onClick={close} disabled={mutation.isPending}>
            Voltar
          </button>
          <button type="submit" className="min-h-11 rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-muted" disabled={!canSubmit}>
            {mutation.isPending ? 'Parcelando...' : 'Parcelar saldo'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
