import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Page } from '@/shared/components/layout/Page';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { useCan } from '@/shared/auth/useCan';
import { parseApiErrorSync } from '@/shared/services/parseApiError';
import { formatCents, formatCurrency, toCents } from '@/shared/utils/money';
import { formatDateOnly } from '@/shared/utils/formatDateOnly';
import { maskDocument, maskSupplierPhone } from '@/modules/suppliers/utils/formatDocument';

import { NfeItemCard } from '../components/NfeItemCard';
import { useConfirmNfeImport, useNfeImport } from '../hooks/useNfeImports';
import {
  buildConfirmBody,
  errorItemIndex,
  initialInstallments,
  initialItemDraft,
  installmentsProblem,
  installmentsSumCents,
  itemProblem,
  itemsTotalCents,
  UNSUPPORTED_ITEMS_MESSAGE,
  type InstallmentDraft,
  type ItemDraft,
  type SupplierDraft,
} from '../utils/review';
import type { INfeImport } from '../types';

const inputClass = 'w-full rounded-md border border-input bg-surface text-foreground px-3 py-2 text-sm';

/** "3526 1011 ..." in groups of 4 (the key may be alphanumeric: CNPJ with letters). */
const formatAccessKey = (key: string) => key.replace(/([0-9A-Z]{4})(?=[0-9A-Z])/g, '$1 ');

export function NfeImportReviewPage() {
  const { id } = useParams<{ id: string }>();
  const { data: note, isLoading, isError } = useNfeImport(id);
  const navigate = useNavigate();

  // The page (unlike the form, which unmounts once the note is re-read as CONFIRMED) stays mounted while
  // the user is on this screen: the redirect after confirming only happens if they did not leave meanwhile.
  const onScreen = useRef(true);
  useEffect(() => {
    onScreen.current = true;
    return () => {
      onScreen.current = false;
    };
  }, []);
  const goToPurchase = (purchaseId: string) => {
    if (onScreen.current) navigate(`/purchases/${purchaseId}`);
  };

  return (
    <Page width="narrow">
      <PageHeader title="Revisão da NF-e" description="Confira o fornecedor, os itens e as parcelas antes de confirmar." backPath="/nfe-imports" backLabel="importações" />

          {isLoading && <p className="text-sm text-muted">Carregando nota...</p>}
          {isError && <div role="alert" className="rounded-lg border border-danger/30 p-6 text-sm text-danger">Não foi possível carregar a importação.</div>}
          {note?.status === 'CONFIRMED' && (
            <div className="rounded-lg border p-6 text-sm">
              Esta nota já foi confirmada.{' '}
              {note.purchaseId && (
                <Link to={`/purchases/${note.purchaseId}`} className="font-medium underline">
                  Ver pedido
                </Link>
              )}
            </div>
          )}
          {note?.status === 'DRAFT' && <ReviewForm key={note.id} note={note} onConfirmed={goToPurchase} />}
    </Page>
  );
}

function ReviewForm({ note, onConfirmed }: { note: INfeImport; onConfirmed: (purchaseId: string) => void }) {
  const canReceive = useCan('purchases.receive');
  const confirm = useConfirmNfeImport(note.id);

  const [items, setItems] = useState<ItemDraft[]>(() => note.items.map(initialItemDraft));
  const [installments, setInstallments] = useState<InstallmentDraft[]>(() => initialInstallments(note));
  const [supplier, setSupplier] = useState<SupplierDraft>({ name: note.supplier.name, email: '', phone: '' });
  const [receive, setReceive] = useState(true);
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});
  const [topError, setTopError] = useState<string | null>(null);

  const totalCents = itemsTotalCents(note.items);
  const sumCents = installmentsSumCents(installments);
  const sumMismatch = sumCents !== totalCents;
  // vNF vs the sum of the items' costs: the note may round its total differently.
  const noteDifferenceCents = Math.abs(toCents(note.totalAmount) - totalCents);
  const unsupported = note.items.some((item) => !item.composesTotal);
  const supplierProblem = !note.supplier.match && supplier.name.trim().length < 2 ? 'Informe o nome do fornecedor.' : null;
  const reason =
    note.items.map((item, position) => itemProblem(item, items[position])).find((problem) => problem !== null) ??
    supplierProblem ??
    installmentsProblem(installments, note.issueDate, totalCents);
  const disabled = confirm.isPending;

  function patchItem(position: number, patch: Partial<ItemDraft>) {
    setItems((current) => current.map((draft, i) => (i === position ? { ...draft, ...patch } : draft)));
  }

  function patchInstallment(position: number, patch: Partial<InstallmentDraft>) {
    setInstallments((current) => current.map((row, i) => (i === position ? { ...row, ...patch } : row)));
  }

  function submit() {
    if (unsupported || reason || confirm.isPending) return;

    setRowErrors({});
    setTopError(null);

    // mutateAsync (not the per-call callbacks of mutate): the callbacks are dropped when this form unmounts,
    // which happens as soon as the note is re-read as CONFIRMED, so the redirect would be lost.
    confirm
      .mutateAsync(buildConfirmBody({ note, items, supplier, installments, receive: canReceive && receive }))
      .then((result) => onConfirmed(result.purchaseId))
      .catch((error: unknown) => {
        const parsed = parseApiErrorSync(error);

        // The axios interceptor already redirects to /login on 401.
        if (parsed.status === 401) return;

        const itemIndex = errorItemIndex(parsed, note);
        const detail = Object.values(parsed.fieldErrors)[0];
        // Shown once: on the item row when it identifies one, otherwise as the alert at the top.
        const text = parsed.code === 'UNKNOWN_ERROR' ? 'Não foi possível confirmar a importação. Verifique os dados e tente novamente.' : detail && !parsed.message.includes(detail) && itemIndex === null ? `${parsed.message} ${detail}` : parsed.message;

        if (itemIndex !== null) setRowErrors({ [itemIndex]: text });
        else setTopError(text);
      });
  }

  return (
    <>
      <section className="rounded-xl border bg-surface p-5 shadow-sm sm:p-6">
        <h2 className="mb-3 text-lg font-semibold">Nota fiscal</h2>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted">Número / série</dt>
            <dd className="font-medium">
              {note.number}/{note.series}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Emissão</dt>
            <dd className="font-medium">{formatDateOnly(note.issueDate)}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-muted">Chave de acesso</dt>
            <dd className="break-all font-mono text-xs">{formatAccessKey(note.accessKey)}</dd>
          </div>
          <div>
            <dt className="text-muted">Total da nota</dt>
            <dd className="font-medium">{formatCurrency(note.totalAmount)}</dd>
          </div>
        </dl>
        {noteDifferenceCents !== 0 && (
          <p data-testid="note-total-difference" className="mt-3 text-sm text-warning">
            Total do pedido difere do total da nota em {formatCents(noteDifferenceCents)} (arredondamento da nota).
          </p>
        )}
      </section>

      {unsupported && (
        <div role="alert" data-testid="unsupported-items" className="rounded-lg border border-danger/30 bg-danger-soft p-3 text-sm text-danger">
          {UNSUPPORTED_ITEMS_MESSAGE}
        </div>
      )}

      <section className="rounded-xl border bg-surface p-5 shadow-sm sm:p-6">
        <h2 className="mb-3 text-lg font-semibold">Fornecedor</h2>
        <p className="text-sm text-muted">{maskDocument(note.supplier.document)}</p>
        {note.supplier.match ? (
          <p className="mt-1 font-medium">{note.supplier.match.name}</p>
        ) : (
          <div className="mt-2 space-y-3">
            <p className="text-sm font-medium text-warning">Será cadastrado</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label htmlFor="supplier-name" className="mb-1 block text-xs font-medium text-muted">
                  Nome do fornecedor
                </label>
                <input id="supplier-name" value={supplier.name} disabled={disabled} maxLength={120} onChange={(event) => setSupplier((s) => ({ ...s, name: event.target.value }))} className={inputClass} />
              </div>
              <div>
                <label htmlFor="supplier-email" className="mb-1 block text-xs font-medium text-muted">
                  E-mail do fornecedor (opcional)
                </label>
                <input id="supplier-email" type="email" value={supplier.email} disabled={disabled} onChange={(event) => setSupplier((s) => ({ ...s, email: event.target.value }))} className={inputClass} />
              </div>
              <div>
                <label htmlFor="supplier-phone" className="mb-1 block text-xs font-medium text-muted">
                  Telefone do fornecedor (opcional)
                </label>
                <input id="supplier-phone" type="tel" maxLength={15} value={supplier.phone} disabled={disabled} onChange={(event) => setSupplier((s) => ({ ...s, phone: maskSupplierPhone(event.target.value) }))} className={inputClass} />
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-xl border bg-surface p-5 shadow-sm sm:p-6">
        <h2 className="mb-3 text-lg font-semibold">Itens ({note.items.length})</h2>
        <ul className="space-y-3">
          {note.items.map((item, position) => (
            <NfeItemCard key={item.index} item={item} draft={items[position]} disabled={disabled} serverError={rowErrors[item.index]} onChange={(patch) => patchItem(position, patch)} />
          ))}
        </ul>
      </section>

      <section className="rounded-xl border bg-surface p-5 shadow-sm sm:p-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Parcelas</h2>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            onClick={() => setInstallments((current) => [...current, { number: null, dueDate: current[current.length - 1]?.dueDate ?? note.issueDate, amount: '' }])}
          >
            <Plus size={16} />
            Adicionar parcela
          </Button>
        </div>

        <ul className="space-y-2">
          {installments.map((row, position) => (
            <li key={position} className="flex flex-wrap items-end gap-3">
              <div className="flex h-10 items-center text-sm text-muted">
                Nº <span data-testid={`installment-number-${position}`}>{row.number ?? '—'}</span>
              </div>
              <div>
                <label htmlFor={`due-${position}`} className="mb-1 block text-xs font-medium text-muted">
                  Vencimento da parcela {position + 1}
                </label>
                <input id={`due-${position}`} type="date" min={note.issueDate} value={row.dueDate} disabled={disabled} onChange={(event) => patchInstallment(position, { dueDate: event.target.value })} className={`${inputClass} h-10`} />
              </div>
              <div>
                <label htmlFor={`amount-${position}`} className="mb-1 block text-xs font-medium text-muted">
                  Valor da parcela {position + 1}
                </label>
                <input id={`amount-${position}`} type="number" min={0} step="0.01" inputMode="decimal" value={row.amount} disabled={disabled} onChange={(event) => patchInstallment(position, { amount: event.target.value })} className={`${inputClass} h-10`} />
              </div>
              <button
                type="button"
                aria-label={`Remover parcela ${position + 1}`}
                disabled={disabled || installments.length === 1}
                onClick={() => setInstallments((current) => current.filter((_, i) => i !== position))}
                className="flex h-10 w-10 items-center justify-center rounded-md text-danger hover:bg-danger-soft disabled:opacity-50"
              >
                <Trash2 size={17} />
              </button>
            </li>
          ))}
        </ul>

        <p data-testid="installments-sum" className="mt-3 text-sm">
          Soma das parcelas: <strong>{formatCents(sumCents)}</strong> · Total do pedido: <strong>{formatCents(totalCents)}</strong>
        </p>
        {sumMismatch && (
          <p data-testid="installments-mismatch" className="mt-1 text-sm text-danger">
            A soma das parcelas ({formatCents(sumCents)}) difere do total do pedido ({formatCents(totalCents)}).
          </p>
        )}
      </section>

      {topError && (
        <div role="alert" data-testid="confirm-error" className="rounded-lg border border-danger/30 bg-danger-soft p-3 text-sm text-danger">
          {topError}
        </div>
      )}

      {reason && (
        <div data-testid="blocking-reason" className="rounded-lg border border-warning/40 bg-warning-soft p-3 text-sm text-warning">
          {reason}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4">
        {canReceive ? (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={receive} disabled={disabled} onChange={(event) => setReceive(event.target.checked)} />
            Dar entrada no estoque agora
          </label>
        ) : (
          <span />
        )}
        <Button type="button" onClick={submit} disabled={unsupported || reason !== null || disabled}>
          {disabled ? 'Confirmando...' : 'Confirmar importação'}
        </Button>
      </div>
    </>
  );
}
