import { useState, type FormEvent } from 'react';
import { Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { FieldError, MoneyInput, fieldA11y } from '@/shared/components/form';
import { parseApiErrorSync, type ApiError } from '@/shared/services/parseApiError';
import { formatMoneyInput, fromCents, moneyTextError, parseMoneyToCents } from '@/shared/utils/money';

import { useUpdateLegacyRow } from '../hooks/useLegacyImports';
import { isMissingLinkedCustomer } from '../utils/rowErrors';
import { CREDIT_PROFILE_LABELS, type CreditProfileCode, type LegacyColumn, type LegacyRow, type LegacyRowDataInput } from '../types';

type Field = 'name' | 'phone' | 'purchaseDate' | 'description' | 'total' | 'paid' | 'dueDates' | 'profileCode' | 'notes';

const COLUMN_OF: Record<Field, LegacyColumn> = {
  name: 'nome',
  phone: 'celular',
  purchaseDate: 'data_compra',
  description: 'descricao',
  total: 'valor_total',
  paid: 'valor_pago',
  dueDates: 'vencimentos',
  profileCode: 'perfil',
  notes: 'observacao',
};

interface DueRow {
  date: string;
  amount: string;
}

interface Values {
  name: string;
  phone: string;
  purchaseDate: string;
  description: string;
  total: string;
  paid: string;
  dueDates: DueRow[];
  profileCode: CreditProfileCode | '';
  notes: string;
}

function initialValues(row: LegacyRow): Values {
  const d = row.data;
  return {
    name: d.name,
    phone: d.phone ?? '',
    purchaseDate: d.purchaseDate ?? '',
    description: d.description ?? '',
    total: d.total ? formatMoneyInput(d.total) : '',
    paid: d.paid ? formatMoneyInput(d.paid) : '',
    dueDates: (d.dueDates ?? []).map((due) => ({ date: due.date, amount: formatMoneyInput(due.amount) })),
    profileCode: d.profileCode ?? '',
    notes: d.notes ?? '',
  };
}

const inputClass = 'w-full min-h-11 rounded-lg border border-input bg-surface px-3 py-2.5 text-base text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 aria-[invalid=true]:border-danger sm:text-sm';
const labelClass = 'mb-1 block text-sm font-medium text-foreground';

interface Props {
  batchId: string;
  row: LegacyRow;
  onClose: () => void;
  /** Troca o vínculo da linha para "criar novo" (cliente vinculado apagado). */
  onCreateNew: () => void;
}

/** Edição de uma linha do lote, na própria linha (no celular, dentro do cartão). Envia só os campos mexidos. */
export function LegacyRowEditor({ batchId, row, onClose, onCreateNew }: Props) {
  const update = useUpdateLegacyRow(batchId);
  const [values, setValues] = useState<Values>(() => initialValues(row));
  const [touched, setTouched] = useState<Set<Field>>(() => new Set());
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [serverError, setServerError] = useState<ApiError | null>(null);
  const prefix = `row-${row.line}`;

  function set<K extends Field>(field: K, value: Values[K]) {
    setValues((current) => ({ ...current, [field]: value }));
    setTouched((current) => new Set(current).add(field));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  function setDue(index: number, patch: Partial<DueRow>) {
    set(
      'dueDates',
      values.dueDates.map((due, i) => (i === index ? { ...due, ...patch } : due)),
    );
  }

  /** Aviso/erro do servidor no campo (o local tem prioridade). */
  function issueOf(field: Field): { message: string; error: boolean } | null {
    if (touched.has(field)) return null;
    const issue = row.issues.find((i) => i.field === COLUMN_OF[field] && i.code !== 'SIMILAR_CUSTOMER' && i.code !== 'SIMILAR_ROW');
    return issue ? { message: issue.message, error: issue.severity === 'ERROR' } : null;
  }

  function fieldProps(field: Field) {
    const local = errors[field];
    const issue = issueOf(field);
    const message = local ?? issue?.message;
    const invalid = Boolean(local) || Boolean(issue?.error);
    const id = `${prefix}-${field}`;
    const cls = `mt-1 text-sm ${invalid ? 'text-danger' : 'text-warning'}`;
    return { id, message, cls, a11y: message ? { ...fieldA11y(id, message), 'aria-invalid': invalid } : {} };
  }

  function build(): LegacyRowDataInput | null {
    const next: Partial<Record<Field, string>> = {};
    const data: LegacyRowDataInput = {};
    for (const field of touched) {
      switch (field) {
        case 'name':
          data.name = values.name.trim();
          break;
        case 'phone':
          data.phone = values.phone.trim() || null;
          break;
        case 'purchaseDate':
          data.purchaseDate = values.purchaseDate || null;
          break;
        case 'description':
          data.description = values.description.trim() || null;
          break;
        case 'notes':
          data.notes = values.notes.trim() || null;
          break;
        case 'profileCode':
          data.profileCode = values.profileCode || null;
          break;
        case 'total': {
          const message = moneyTextError(values.total);
          if (message) next.total = message;
          else data.total = fromCents(parseMoneyToCents(values.total) ?? 0);
          break;
        }
        case 'paid': {
          const message = moneyTextError(values.paid, { allowEmpty: true });
          if (message) next.paid = message;
          else data.paid = fromCents(parseMoneyToCents(values.paid) ?? 0);
          break;
        }
        case 'dueDates': {
          const list = values.dueDates;
          const bad = list.findIndex((due) => !due.date || moneyTextError(due.amount) !== null || (parseMoneyToCents(due.amount) ?? 0) <= 0);
          if (bad >= 0) next.dueDates = `Confira o vencimento ${bad + 1}: informe a data e um valor maior que zero.`;
          else data.dueDates = list.length === 0 ? null : list.map((due) => ({ date: due.date, amount: fromCents(parseMoneyToCents(due.amount) ?? 0) }));
          break;
        }
      }
    }
    setErrors(next);
    return Object.keys(next).length > 0 ? null : data;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setServerError(null);
    const data = build();
    if (!data) return;
    if (Object.keys(data).length === 0) {
      onClose();
      return;
    }
    try {
      await update.mutateAsync({ rowId: row.id, input: { data } });
      onClose();
    } catch (error) {
      const parsed = parseApiErrorSync(error);
      setServerError(parsed);
    }
  }

  const name = fieldProps('name');
  const phone = fieldProps('phone');
  const date = fieldProps('purchaseDate');
  const description = fieldProps('description');
  const total = fieldProps('total');
  const paid = fieldProps('paid');
  const due = fieldProps('dueDates');
  const profile = fieldProps('profileCode');
  const notes = fieldProps('notes');
  const dueSumCents = values.dueDates.reduce((sum, d) => sum + (parseMoneyToCents(d.amount) ?? 0), 0);
  const missingCustomer = serverError !== null && isMissingLinkedCustomer(row, serverError);

  return (
    <form aria-label={`Editar linha ${row.line}`} onSubmit={submit} noValidate className="flex flex-col gap-4 rounded-xl border border-border bg-surface-muted/40 p-3 sm:p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label htmlFor={name.id} className={labelClass}>
            Nome
          </label>
          <input id={name.id} value={values.name} maxLength={120} onChange={(e) => set('name', e.target.value)} className={inputClass} {...name.a11y} />
          <FieldError id={name.id} message={name.message} className={name.cls} />
        </div>
        <div>
          <label htmlFor={phone.id} className={labelClass}>
            Celular
          </label>
          <input id={phone.id} type="tel" inputMode="tel" value={values.phone} maxLength={40} onChange={(e) => set('phone', e.target.value)} className={inputClass} {...phone.a11y} />
          <FieldError id={phone.id} message={phone.message} className={phone.cls} />
        </div>
        <div>
          <label htmlFor={date.id} className={labelClass}>
            Data da compra
          </label>
          <input id={date.id} type="date" value={values.purchaseDate} onChange={(e) => set('purchaseDate', e.target.value)} className={inputClass} {...date.a11y} />
          <FieldError id={date.id} message={date.message} className={date.cls} />
        </div>
        <div>
          <label htmlFor={description.id} className={labelClass}>
            Descrição
          </label>
          <input id={description.id} value={values.description} maxLength={200} onChange={(e) => set('description', e.target.value)} className={inputClass} {...description.a11y} />
          <FieldError id={description.id} message={description.message} className={description.cls} />
        </div>
        <div>
          <label htmlFor={total.id} className={labelClass}>
            Valor total
          </label>
          <MoneyInput id={total.id} value={values.total} onChange={(e) => set('total', e.target.value)} {...total.a11y} />
          <FieldError id={total.id} message={total.message} className={total.cls} />
        </div>
        <div>
          <label htmlFor={paid.id} className={labelClass}>
            Valor pago
          </label>
          <MoneyInput id={paid.id} value={values.paid} onChange={(e) => set('paid', e.target.value)} {...paid.a11y} />
          <FieldError id={paid.id} message={paid.message} className={paid.cls} />
        </div>
        <div>
          <label htmlFor={profile.id} className={labelClass}>
            Perfil
          </label>
          <select id={profile.id} value={values.profileCode} onChange={(e) => set('profileCode', e.target.value as CreditProfileCode | '')} className={inputClass} {...profile.a11y}>
            <option value="">Não informar</option>
            {(Object.keys(CREDIT_PROFILE_LABELS) as CreditProfileCode[]).map((code) => (
              <option key={code} value={code}>
                {CREDIT_PROFILE_LABELS[code]}
              </option>
            ))}
          </select>
          <FieldError id={profile.id} message={profile.message} className={profile.cls} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor={notes.id} className={labelClass}>
            Observação
          </label>
          <input id={notes.id} value={values.notes} maxLength={500} onChange={(e) => set('notes', e.target.value)} className={inputClass} {...notes.a11y} />
          <FieldError id={notes.id} message={notes.message} className={notes.cls} />
        </div>
      </div>

      <fieldset className="flex flex-col gap-2" aria-describedby={due.message ? `${due.id}-error` : undefined}>
        <legend className={labelClass}>Vencimentos</legend>
        <p className="text-xs text-muted">Opcional. Sem vencimentos, a dívida fica como uma parcela "a combinar". A soma deve dar o valor em aberto.</p>
        {values.dueDates.length > 0 && (
          <ul className="flex flex-col gap-2">
            {values.dueDates.map((item, index) => (
              <li key={index} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
                <div className="min-w-0">
                  <label htmlFor={`${prefix}-due-date-${index}`} className="sr-only">
                    Data do vencimento {index + 1}
                  </label>
                  <input id={`${prefix}-due-date-${index}`} type="date" value={item.date} onChange={(e) => setDue(index, { date: e.target.value })} className={`${inputClass} px-2 sm:px-3`} />
                </div>
                <div className="min-w-0">
                  <label htmlFor={`${prefix}-due-amount-${index}`} className="sr-only">
                    Valor do vencimento {index + 1}
                  </label>
                  <MoneyInput id={`${prefix}-due-amount-${index}`} value={item.amount} onChange={(e) => setDue(index, { amount: e.target.value })} />
                </div>
                <button
                  type="button"
                  aria-label={`Remover vencimento ${index + 1}`}
                  onClick={() => set('dueDates', values.dueDates.filter((_, i) => i !== index))}
                  className="flex h-11 w-11 items-center justify-center rounded-lg text-danger hover:bg-danger-soft"
                >
                  <Trash2 size={17} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" className="min-h-11" onClick={() => set('dueDates', [...values.dueDates, { date: '', amount: '' }])}>
            <Plus size={16} aria-hidden="true" />
            Adicionar vencimento
          </Button>
          {values.dueDates.length > 0 && <span className="text-sm text-muted tabular-nums">Soma: {formatMoneyInput(fromCents(dueSumCents))}</span>}
        </div>
        <FieldError id={due.id} message={due.message} className={due.cls} />
      </fieldset>

      {serverError && (
        <div role="alert" className="rounded-lg border border-danger/30 bg-danger-soft p-3 text-sm text-danger">
          <p>{serverError.message}</p>
          {missingCustomer && (
            <>
              <p className="mt-1">O cliente vinculado pode ter sido excluído. Crie um cliente novo para esta linha e salve de novo.</p>
              <Button type="button" variant="outline" className="mt-2 min-h-11" disabled={update.isPending} onClick={onCreateNew}>
                Criar cliente novo
              </Button>
            </>
          )}
        </div>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" className="min-h-11" onClick={onClose} disabled={update.isPending}>
          Cancelar
        </Button>
        <Button type="submit" className="min-h-11" disabled={update.isPending}>
          {update.isPending ? 'Salvando...' : 'Salvar linha'}
        </Button>
      </div>
    </form>
  );
}
