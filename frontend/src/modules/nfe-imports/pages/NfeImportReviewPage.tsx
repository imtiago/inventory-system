import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Page } from '@/shared/components/layout/Page';
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

const inputClass = 'w-full rounded-md border px-3 py-2 text-sm';

/** "3526 1011 ..." in groups of 4 (the key may be alphanumeric: CNPJ with letters). */
const formatAccessKey = (key: string) => key.replace(/([0-9A-Z]{4})(?=[0-9A-Z])/g, '$1 ');

export function NfeImportReviewPage() {
  const { id } = useParams<{ id: string }>();
  const { data: note, isLoading, isError } = useNfeImport(id);

  return (
    <Page>
      <div className="min-h-0 w-full flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-4 pb-8 sm:px-6">
          <header className="flex items-center gap-3">
            <Link to="/nfe-imports" aria-label="Voltar para importações" className="rounded-lg border p-2 transition hover:bg-gray-50">
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="text-2xl font-semibold">Revisão da NF-e</h1>
              <p className="mt-1 text-sm text-gray-500">Confira o fornecedor, os itens e as parcelas antes de confirmar.</p>
            </div>
          </header>

          {isLoading && <p className="text-sm text-gray-500">Carregando nota...</p>}
          {isError && <div role="alert" className="rounded-lg border border-red-200 p-6 text-sm text-red-600">Não foi possível carregar a importação.</div>}
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
          {note?.status === 'DRAFT' && <ReviewForm key={note.id} note={note} />}
        </div>
      </div>
    </Page>
  );
}

function ReviewForm({ note }: { note: INfeImport }) {
  const navigate = useNavigate();
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

    confirm.mutate(buildConfirmBody({ note, items, supplier, installments, receive: canReceive && receive }), {
      onSuccess: (result) => navigate(`/purchases/${result.purchaseId}`),
      onError: (error) => {
        const parsed = parseApiErrorSync(error);

        // The axios interceptor already redirects to /login on 401.
        if (parsed.status === 401) return;

        const itemIndex = errorItemIndex(parsed, note);
        const detail = Object.values(parsed.fieldErrors)[0];
        // Shown once: on the item row when it identifies one, otherwise as the alert at the top.
        const text = parsed.code === 'UNKNOWN_ERROR' ? 'Não foi possível confirmar a importação. Verifique os dados e tente novamente.' : detail && !parsed.message.includes(detail) && itemIndex === null ? `${parsed.message} ${detail}` : parsed.message;

        if (itemIndex !== null) setRowErrors({ [itemIndex]: text });
        else setTopError(text);
      },
    });
  }

  return (
    <>
      <section className="rounded-xl border bg-white p-5 shadow-sm sm:p-6">
        <h2 className="mb-3 text-lg font-semibold">Nota fiscal</h2>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-gray-500">Número / série</dt>
            <dd className="font-medium">
              {note.number}/{note.series}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">Emissão</dt>
            <dd className="font-medium">{formatDateOnly(note.issueDate)}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-gray-500">Chave de acesso</dt>
            <dd className="break-all font-mono text-xs">{formatAccessKey(note.accessKey)}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Total da nota</dt>
            <dd className="font-medium">{formatCurrency(note.totalAmount)}</dd>
          </div>
        </dl>
        {noteDifferenceCents !== 0 && (
          <p data-testid="note-total-difference" className="mt-3 text-sm text-amber-700">
            Total do pedido difere do total da nota em {formatCents(noteDifferenceCents)} (arredondamento da nota).
          </p>
        )}
      </section>

      {unsupported && (
        <div role="alert" data-testid="unsupported-items" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {UNSUPPORTED_ITEMS_MESSAGE}
        </div>
      )}

      <section className="rounded-xl border bg-white p-5 shadow-sm sm:p-6">
        <h2 className="mb-3 text-lg font-semibold">Fornecedor</h2>
        <p className="text-sm text-gray-500">{maskDocument(note.supplier.document)}</p>
        {note.supplier.match ? (
          <p className="mt-1 font-medium">{note.supplier.match.name}</p>
        ) : (
          <div className="mt-2 space-y-3">
            <p className="text-sm font-medium text-amber-700">Será cadastrado</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label htmlFor="supplier-name" className="mb-1 block text-xs font-medium text-gray-600">
                  Nome do fornecedor
                </label>
                <input id="supplier-name" value={supplier.name} disabled={disabled} maxLength={120} onChange={(event) => setSupplier((s) => ({ ...s, name: event.target.value }))} className={inputClass} />
              </div>
              <div>
                <label htmlFor="supplier-email" className="mb-1 block text-xs font-medium text-gray-600">
                  E-mail do fornecedor (opcional)
                </label>
                <input id="supplier-email" type="email" value={supplier.email} disabled={disabled} onChange={(event) => setSupplier((s) => ({ ...s, email: event.target.value }))} className={inputClass} />
              </div>
              <div>
                <label htmlFor="supplier-phone" className="mb-1 block text-xs font-medium text-gray-600">
                  Telefone do fornecedor (opcional)
                </label>
                <input id="supplier-phone" type="tel" maxLength={15} value={supplier.phone} disabled={disabled} onChange={(event) => setSupplier((s) => ({ ...s, phone: maskSupplierPhone(event.target.value) }))} className={inputClass} />
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-xl border bg-white p-5 shadow-sm sm:p-6">
        <h2 className="mb-3 text-lg font-semibold">Itens ({note.items.length})</h2>
        <ul className="space-y-3">
          {note.items.map((item, position) => (
            <NfeItemCard key={item.index} item={item} draft={items[position]} disabled={disabled} serverError={rowErrors[item.index]} onChange={(patch) => patchItem(position, patch)} />
          ))}
        </ul>
      </section>

      <section className="rounded-xl border bg-white p-5 shadow-sm sm:p-6">
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
              <div className="pb-2 text-sm text-gray-500">
                Nº <span data-testid={`installment-number-${position}`}>{row.number ?? '—'}</span>
              </div>
              <div>
                <label htmlFor={`due-${position}`} className="mb-1 block text-xs font-medium text-gray-600">
                  Vencimento da parcela {position + 1}
                </label>
                <input id={`due-${position}`} type="date" min={note.issueDate} value={row.dueDate} disabled={disabled} onChange={(event) => patchInstallment(position, { dueDate: event.target.value })} className={inputClass} />
              </div>
              <div>
                <label htmlFor={`amount-${position}`} className="mb-1 block text-xs font-medium text-gray-600">
                  Valor da parcela {position + 1}
                </label>
                <input id={`amount-${position}`} type="number" min={0} step="0.01" inputMode="decimal" value={row.amount} disabled={disabled} onChange={(event) => patchInstallment(position, { amount: event.target.value })} className={inputClass} />
              </div>
              <button
                type="button"
                aria-label={`Remover parcela ${position + 1}`}
                disabled={disabled || installments.length === 1}
                onClick={() => setInstallments((current) => current.filter((_, i) => i !== position))}
                className="rounded-md p-2 text-red-600 hover:bg-red-50 disabled:opacity-50"
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
          <p data-testid="installments-mismatch" className="mt-1 text-sm text-red-600">
            A soma das parcelas ({formatCents(sumCents)}) difere do total do pedido ({formatCents(totalCents)}).
          </p>
        )}
      </section>

      {topError && (
        <div role="alert" data-testid="confirm-error" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {topError}
        </div>
      )}

      {reason && (
        <div data-testid="blocking-reason" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
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
