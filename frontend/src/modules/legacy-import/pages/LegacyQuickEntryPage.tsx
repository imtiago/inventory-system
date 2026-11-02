import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { EntitySearchSelect } from '@/shared/components/form/EntitySearchSelect';
import { FieldError, MoneyInput, fieldA11y } from '@/shared/components/form';
import { Page } from '@/shared/components/layout/Page';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { parseApiErrorSync } from '@/shared/services/parseApiError';
import { formatCents, fromCents, moneyTextError, parseMoneyToCents } from '@/shared/utils/money';

import { useAddLegacyRows, useCreateManualLegacyBatch, useCustomerOptions } from '../hooks/useLegacyImports';
import type { AddLegacyRowsInput, QuickEntryDebt } from '../types';
import { plural } from '../utils/plural';

interface DebtDraft {
  amount: string;
  purchaseDate: string;
  notes: string;
}

const emptyDebt = (): DebtDraft => ({ amount: '', purchaseDate: '', notes: '' });

const inputClass = 'w-full min-h-11 rounded-lg border border-input bg-surface px-3 py-2.5 text-base text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 aria-[invalid=true]:border-danger sm:text-sm';
const labelClass = 'mb-1 block text-sm font-medium text-foreground';

type Mode = 'existing' | 'new';
type After = 'review' | 'another';

/** Lançamento rápido (pensado para o celular): um cliente e uma ou mais dívidas, que entram num lote em revisão. */
export function LegacyQuickEntryPage() {
  const navigate = useNavigate();
  const params = useParams<{ id?: string }>();
  const [batchId, setBatchId] = useState<string | undefined>(params.id);
  const [mode, setMode] = useState<Mode>('existing');
  const [customerId, setCustomerId] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [debts, setDebts] = useState<DebtDraft[]>([emptyDebt()]);
  const [customerError, setCustomerError] = useState<string | null>(null);
  const [debtErrors, setDebtErrors] = useState<(string | null)[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);
  const create = useCreateManualLegacyBatch();
  const add = useAddLegacyRows();
  const pending = create.isPending || add.isPending;

  const totalCents = debts.reduce((sum, d) => sum + (parseMoneyToCents(d.amount) ?? 0), 0);

  function patchDebt(index: number, patch: Partial<DebtDraft>) {
    setDebts((current) => current.map((d, i) => (i === index ? { ...d, ...patch } : d)));
    if (patch.amount !== undefined) setDebtErrors((current) => current.map((e, i) => (i === index ? null : e)));
  }

  function validate(): AddLegacyRowsInput | null {
    let ok = true;
    let customer: AddLegacyRowsInput['customer'] | null = null;
    if (mode === 'existing') {
      if (customerId) customer = { existingId: customerId };
    } else if (name.trim()) {
      customer = phone.trim() ? { name: name.trim(), phone: phone.trim() } : { name: name.trim() };
    }
    if (!customer) {
      ok = false;
      setCustomerError(mode === 'existing' ? 'Escolha um cliente cadastrado ou informe um novo.' : 'Informe o nome do cliente.');
    } else setCustomerError(null);

    const errors = debts.map((d) => {
      const message = moneyTextError(d.amount);
      if (message) return message;
      return (parseMoneyToCents(d.amount) ?? 0) > 0 ? null : 'O valor deve ser maior que zero';
    });
    setDebtErrors(errors);
    if (errors.some(Boolean)) ok = false;
    if (!ok || !customer) return null;

    return {
      customer,
      debts: debts.map((d) => {
        const debt: QuickEntryDebt = { amount: fromCents(parseMoneyToCents(d.amount) ?? 0) };
        if (d.purchaseDate) debt.purchaseDate = d.purchaseDate;
        if (d.notes.trim()) debt.notes = d.notes.trim();
        return debt;
      }),
    };
  }

  async function submit(after: After, event?: FormEvent) {
    event?.preventDefault();
    if (pending) return;
    setServerError(null);
    setAdded(null);
    const input = validate();
    if (!input) return;
    try {
      let id = batchId;
      if (!id) {
        id = (await create.mutateAsync()).id;
        // Se o envio das linhas falhar, a nova tentativa usa o mesmo lote.
        setBatchId(id);
      }
      const batch = await add.mutateAsync({ batchId: id, input });
      if (after === 'review') {
        navigate(`/finance/legacy-imports/${id}`);
        return;
      }
      setCustomerId('');
      setName('');
      setPhone('');
      setDebts([emptyDebt()]);
      setDebtErrors([]);
      setAdded(`Lançamento adicionado ao lote (${plural(batch.rows.length, 'linha', 'linhas')}). Lance o próximo cliente.`);
    } catch (error) {
      setServerError(parseApiErrorSync(error).message || 'Não foi possível adicionar o lançamento.');
    }
  }

  const backPath = batchId ? `/finance/legacy-imports/${batchId}` : '/finance/legacy-imports';

  return (
    <Page width="narrow">
      <PageHeader
        title="Lançamento rápido"
        backPath={backPath}
        backLabel={batchId ? 'revisão do lote' : 'migração do caderninho'}
        description="Escolha o cliente e lance as dívidas do caderno. Tudo vai para a revisão antes de gravar."
      />

      <form noValidate onSubmit={(e) => submit('review', e)} className="flex flex-col gap-6">
        <section aria-labelledby="qe-customer-title" className="flex flex-col gap-4 rounded-xl bg-surface p-4 shadow sm:p-6">
          <h2 id="qe-customer-title" className="text-lg font-semibold text-foreground">
            Cliente
          </h2>
          <div role="radiogroup" aria-label="Tipo de cliente" className="grid grid-cols-2 gap-2">
            {(
              [
                ['existing', 'Cliente cadastrado'],
                ['new', 'Cliente novo'],
              ] as const
            ).map(([value, label]) => (
              <label key={value} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm ${mode === value ? 'border-primary bg-primary/10' : 'border-border'}`}>
                <input
                  type="radio"
                  name="qe-mode"
                  value={value}
                  checked={mode === value}
                  onChange={() => {
                    setMode(value);
                    setCustomerError(null);
                  }}
                  className="h-5 w-5"
                />
                <span className="font-medium text-foreground">{label}</span>
              </label>
            ))}
          </div>

          {mode === 'existing' ? (
            <EntitySearchSelect useOptions={useCustomerOptions} value={customerId} onChange={(id) => { setCustomerId(id); setCustomerError(null); }} ariaLabel="Buscar cliente" placeholder="Nome, código ou celular" error={customerError ?? undefined} />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="qe-name" className={labelClass}>
                  Nome do cliente
                </label>
                <input
                  id="qe-name"
                  value={name}
                  maxLength={120}
                  autoComplete="off"
                  onChange={(e) => {
                    setName(e.target.value);
                    setCustomerError(null);
                  }}
                  className={inputClass}
                  {...fieldA11y('qe-name', customerError)}
                />
                <FieldError id="qe-name" message={customerError ?? undefined} />
              </div>
              <div>
                <label htmlFor="qe-phone" className={labelClass}>
                  Celular (opcional)
                </label>
                <input id="qe-phone" type="tel" inputMode="tel" value={phone} maxLength={40} autoComplete="off" onChange={(e) => setPhone(e.target.value)} className={inputClass} />
              </div>
              <p className="text-xs text-muted sm:col-span-2">Se já existir cliente com nome parecido, a revisão mostra e você decide se é a mesma pessoa.</p>
            </div>
          )}
        </section>

        <section aria-labelledby="qe-debts-title" className="flex flex-col gap-4 rounded-xl bg-surface p-4 shadow sm:p-6">
          <h2 id="qe-debts-title" className="text-lg font-semibold text-foreground">
            Dívidas
          </h2>
          <ol className="flex flex-col gap-4">
            {debts.map((debt, index) => {
              const n = index + 1;
              const amountId = `qe-amount-${index}`;
              const error = debtErrors[index] ?? undefined;
              return (
                <li key={index} data-testid={`debt-${index}`} className="flex flex-col gap-3 rounded-xl border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-foreground">{`Dívida ${n}`}</span>
                    {debts.length > 1 && (
                      <button
                        type="button"
                        aria-label={`Remover dívida ${n}`}
                        onClick={() => {
                          setDebts((current) => current.filter((_, i) => i !== index));
                          setDebtErrors((current) => current.filter((_, i) => i !== index));
                        }}
                        className="flex h-11 w-11 items-center justify-center rounded-lg text-danger hover:bg-danger-soft"
                      >
                        <Trash2 size={17} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label htmlFor={amountId} className={labelClass}>
                        Valor <span className="sr-only">{`da dívida ${n}`}</span>
                      </label>
                      <MoneyInput id={amountId} value={debt.amount} onChange={(e) => patchDebt(index, { amount: e.target.value })} {...fieldA11y(amountId, error)} />
                      <FieldError id={amountId} message={error} />
                    </div>
                    <div>
                      <label htmlFor={`qe-date-${index}`} className={labelClass}>
                        Data da compra <span className="sr-only">{`da dívida ${n}`}</span> (se souber)
                      </label>
                      <input id={`qe-date-${index}`} type="date" value={debt.purchaseDate} onChange={(e) => patchDebt(index, { purchaseDate: e.target.value })} className={inputClass} />
                    </div>
                    <div className="sm:col-span-2">
                      <label htmlFor={`qe-notes-${index}`} className={labelClass}>
                        Observação <span className="sr-only">{`da dívida ${n}`}</span>
                      </label>
                      <input id={`qe-notes-${index}`} value={debt.notes} maxLength={500} onChange={(e) => patchDebt(index, { notes: e.target.value })} className={inputClass} />
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button type="button" variant="outline" className="min-h-11" onClick={() => setDebts((current) => [...current, emptyDebt()])}>
              <Plus size={16} aria-hidden="true" />
              Adicionar outra dívida
            </Button>
            <span className="text-sm text-muted tabular-nums">{`Total: ${formatCents(totalCents)}`}</span>
          </div>
        </section>

        {serverError && (
          <div role="alert" className="rounded-lg border border-danger/30 bg-danger-soft p-3 text-sm text-danger">
            {serverError}
          </div>
        )}
        {added && (
          <div role="status" className="rounded-lg border border-success/30 bg-success-soft p-3 text-sm text-success">
            <p>{added}</p>
            {batchId && (
              <Link to={`/finance/legacy-imports/${batchId}`} className="mt-1 inline-block font-medium underline">
                Revisar o lote
              </Link>
            )}
          </div>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" className="min-h-11" disabled={pending} onClick={() => submit('another')}>
            Adicionar e lançar outro
          </Button>
          <Button type="submit" className="min-h-11" disabled={pending}>
            {pending ? 'Adicionando...' : 'Adicionar e revisar'}
          </Button>
        </div>
      </form>
    </Page>
  );
}
