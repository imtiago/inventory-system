import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Trash2 } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Page } from '@/shared/components/layout/Page';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { FormAutocomplete, MoneyInput, QuantityInput, FieldError, fieldA11y } from '@/shared/components/form';
import { useBreakpoint } from '@/shared/hooks/useMediaQuery';
import { parseApiErrorSync } from '@/shared/services/parseApiError';
import { applyFieldErrors } from '@/shared/utils/applyFieldErrors';
import { formatCents } from '@/shared/utils/money';
import { todayInBusinessTz } from '@/shared/utils/businessDate';
import { formatDateOnly } from '@/shared/utils/formatDateOnly';
import { useProductByBarcode } from '@/modules/inventory/hooks/useProductByBarcode';
import { SaleBarcodeInput } from '@/modules/sales/components/SaleBarcodeInput';
import { addDaysToDateOnly, buildInstallments } from '@/modules/sales/utils/installments';
import { useSupplierSearch } from '@/modules/suppliers/hooks/useSuppliers';
import { maskDocument } from '@/modules/suppliers/utils/formatDocument';
import type { ISupplier } from '@/modules/suppliers/types';

import { useCreatePurchase } from '../hooks/usePurchases';
import { itemTotalCents, moneyFieldCents, moneyFieldError, moneyFieldToSend, parseQuantity, type IPurchaseDraftItem } from '../utils/purchaseTotals';

type PurchaseFormValues = {
  supplierId: string;
  purchaseDate: string;
  firstDueDate: string;
  notes: string;
};

type PaymentMode = 'cash' | 'installments';

const MAX_INSTALLMENTS = 12;
const DEFAULT_FIRST_DUE_DAYS = 30;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const inputClass = 'w-full rounded-lg border border-input bg-surface text-foreground px-3 py-2';
const cellInputClass = 'w-28 rounded-lg border border-input bg-surface text-foreground py-1.5 pl-9 pr-2 text-sm';
const cardMoneyClass = 'h-11 w-full rounded-lg border border-input bg-surface text-foreground py-2 pl-10 pr-3 text-base';

const MONEY_FIELDS = [
  { key: 'unitPrice', header: 'Preço unitário', label: 'Preço unitário de' },
  { key: 'discount', header: 'Desconto', label: 'Desconto de' },
  { key: 'freight', header: 'Frete', label: 'Frete de' },
  { key: 'tax', header: 'Imposto', label: 'Imposto de' },
] as const;

/** First reason that blocks the submit, mirroring the backend rules (INVALID_ITEM_TOTAL / PURCHASE_TOTAL_ZERO). */
function blockingReason(items: IPurchaseDraftItem[], totalCents: number): string | null {
  if (items.length === 0) return null;

  for (const item of items) {
    if (parseQuantity(item.quantity) === null) return `${item.productName}: informe uma quantidade inteira maior que zero.`;

    const fieldError = [item.unitPrice, item.discount, item.freight, item.tax].map(moneyFieldError).find((message) => message !== null);

    if (fieldError) return `${item.productName}: ${fieldError.charAt(0).toLowerCase()}${fieldError.slice(1)}.`;

    if ([item.unitPrice, item.discount, item.freight, item.tax].some((text) => moneyFieldCents(text) === null)) return `${item.productName}: informe valores válidos (zero ou mais).`;

    const total = itemTotalCents(item);

    if (total === null || total < 0) return `${item.productName}: o total do item não pode ser negativo.`;
  }

  return totalCents <= 0 ? 'O total do pedido deve ser maior que zero.' : null;
}

export function PurchaseCreatePage() {
  const navigate = useNavigate();
  const isWide = useBreakpoint('md');
  const today = todayInBusinessTz();

  const {
    control,
    setError,
    clearErrors,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PurchaseFormValues>({
    defaultValues: { supplierId: '', purchaseDate: today, firstDueDate: addDaysToDateOnly(today, DEFAULT_FIRST_DUE_DAYS), notes: '' },
  });

  const supplierId = useWatch({ control, name: 'supplierId' });
  const purchaseDate = useWatch({ control, name: 'purchaseDate' });
  const firstDueDate = useWatch({ control, name: 'firstDueDate' });

  const [items, setItems] = useState<IPurchaseDraftItem[]>([]);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('cash');
  const [installments, setInstallments] = useState(2);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState<ISupplier | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const { data: supplierData, isFetching: suppliersLoading, isError: suppliersError } = useSupplierSearch(supplierSearch);
  const { loading: variantLoading, searchByBarcode } = useProductByBarcode();
  const createMutation = useCreatePurchase();

  const suppliers = supplierData?.data ?? [];
  const supplierOptions = selectedSupplier && !suppliers.some((s) => s.id === selectedSupplier.id) ? [selectedSupplier, ...suppliers] : suppliers;

  const isInstallments = paymentMode === 'installments';
  const itemTotals = items.map((item) => itemTotalCents(item));
  const totalCents = itemTotals.reduce<number>((sum, value) => sum + (value ?? 0), 0);
  const reason = blockingReason(items, totalCents);
  const isSubmitDisabled = !supplierId || items.length === 0 || reason !== null || createMutation.isPending;

  const preview = isInstallments && totalCents > 0 && DATE_PATTERN.test(firstDueDate) ? buildInstallments(totalCents, installments, firstDueDate) : [];

  function updateItem(variantId: string, field: keyof IPurchaseDraftItem, value: string) {
    setItems((current) => current.map((item) => (item.productVariantId === variantId ? { ...item, [field]: value } : item)));
  }

  async function handleBarcodeSubmit(barcode: string) {
    setFeedback(null);

    const variant = await searchByBarcode(barcode);

    if (!variant) {
      setFeedback({ type: 'error', message: 'Variante não encontrada. Confira o código de barras e tente novamente.' });
      return;
    }

    setItems((current) => {
      const existing = current.find((item) => item.productVariantId === variant.id);

      if (existing) {
        return current.map((item) => (item === existing ? { ...item, quantity: String((parseQuantity(item.quantity) ?? 0) + 1) } : item));
      }

      return [...current, { productVariantId: variant.id, productName: variant.name, productCode: variant.code, quantity: '1', unitPrice: '', discount: '', freight: '', tax: '' }];
    });
  }

  const submit = handleSubmit((values) => {
    setFeedback(null);

    if (values.purchaseDate > todayInBusinessTz()) {
      setError('purchaseDate', { type: 'validate', message: 'A data do pedido não pode ser futura.' });
      return;
    }

    if (isInstallments && (!DATE_PATTERN.test(values.firstDueDate) || values.firstDueDate < values.purchaseDate)) {
      setError('firstDueDate', { type: 'validate', message: 'O primeiro vencimento não pode ser anterior à data do pedido.' });
      return;
    }

    if (createMutation.isPending) return;

    const notes = values.notes.trim();

    createMutation.mutate(
      {
        supplierId: values.supplierId,
        purchaseDate: values.purchaseDate,
        ...(notes ? { notes } : {}),
        items: items.map((item) => ({
          productVariantId: item.productVariantId,
          quantity: parseQuantity(item.quantity) as number,
          unitPrice: moneyFieldToSend(item.unitPrice),
          discount: moneyFieldToSend(item.discount),
          freight: moneyFieldToSend(item.freight),
          tax: moneyFieldToSend(item.tax),
        })),
        paymentTerms: isInstallments ? { installments, firstDueDate: values.firstDueDate } : { installments: 1 },
      },
      {
        onSuccess: (purchase) => navigate(`/purchases/${purchase.id}`),
        onError: (error) => {
          const { fieldErrors, message, code, status } = parseApiErrorSync(error);

          // The axios interceptor already redirects to /login on 401.
          if (status === 401) return;

          const mapped: Record<string, string> = {};
          for (const [field, text] of Object.entries(fieldErrors)) {
            mapped[field === 'paymentTerms.firstDueDate' ? 'firstDueDate' : field] = text;
          }

          const { applied, unmatched } = applyFieldErrors(setError, mapped, ['supplierId', 'purchaseDate', 'firstDueDate', 'notes']);
          const detail = Object.values(unmatched)[0];

          // Shown once: inline when fully mapped to a field, otherwise as the alert (never both).
          if (applied.length > 0 && !detail) return;

          setFeedback({
            type: 'error',
            message: code === 'UNKNOWN_ERROR' ? 'Não foi possível registrar o pedido. Verifique os dados e tente novamente.' : detail ? `${message} ${detail}` : message,
          });
        },
      },
    );
  });

  return (
    <Page width="narrow">
      <PageHeader title="Novo pedido de compra" description="Selecione o fornecedor e lance os itens." backPath="/purchases" backLabel="pedidos de compra" />

          <section className="rounded-xl border bg-surface p-5 shadow sm:p-6">
            <h2 className="mb-4 text-lg font-semibold">Fornecedor e data</h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormAutocomplete<PurchaseFormValues, ISupplier, string, 'supplierId'>
                control={control}
                name="supplierId"
                label="Fornecedor"
                placeholder="Digite o nome do fornecedor..."
                options={supplierOptions}
                getOptionValue={(supplier) => supplier.id}
                getOptionLabel={(supplier) => supplier.name}
                getOptionDescription={(supplier) => maskDocument(supplier.document)}
                onSearchChange={setSupplierSearch}
                onOptionChange={(supplier) => setSelectedSupplier(supplier)}
                minSearchLength={2}
                loading={suppliersLoading}
                emptyMessage="Nenhum fornecedor encontrado."
                required
                rules={{ required: 'Selecione um fornecedor.' }}
              />

              <div>
                <label htmlFor="purchase-date" className="mb-1 block text-sm font-medium">
                  Data do pedido
                </label>
                <input id="purchase-date" {...fieldA11y("purchase-date", errors.purchaseDate?.message)} type="date" max={today} {...register('purchaseDate', { required: 'Informe a data do pedido.' })} className={inputClass} />
                <FieldError id="purchase-date" message={errors.purchaseDate?.message} />
              </div>
            </div>

            {suppliersError && (
              <p role="alert" className="mt-2 text-sm text-danger">
                Não foi possível consultar os fornecedores.
              </p>
            )}
          </section>

          <SaleBarcodeInput loading={variantLoading} onSubmitBarcode={handleBarcodeSubmit} />

          {feedback && (
            <div role="alert" className="rounded-lg border border-danger/30 bg-danger-soft p-3 text-sm text-danger">
              {feedback.message}
            </div>
          )}

          <section className="rounded-xl border bg-surface p-5 shadow sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Itens do pedido</h2>
              <Button type="button" variant="outline" onClick={() => setItems([])} disabled={items.length === 0 || createMutation.isPending}>
                Limpar itens
              </Button>
            </div>

            {items.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center">
                <Package className="mx-auto mb-3 text-subtle" size={32} />
                <p className="font-medium">Nenhum produto lançado</p>
                <p className="mt-1 text-sm text-muted">Digite ou escaneie um código de barras para adicionar uma variante.</p>
              </div>
            ) : (
              isWide ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-left text-sm">
                  <thead>
                    <tr className="border-b text-muted">
                      <th className="px-2 py-3 font-medium">Variante</th>
                      <th className="px-2 py-3 font-medium">Quantidade</th>
                      {MONEY_FIELDS.map((field) => (
                        <th key={field.key} className="px-2 py-3 font-medium">
                          {field.header}
                        </th>
                      ))}
                      <th className="px-2 py-3 font-medium">Total</th>
                      <th className="px-2 py-3 font-medium">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, index) => {
                      const total = itemTotals[index];

                      return (
                        <tr key={item.productVariantId} className="border-b last:border-0">
                          <td className="px-2 py-3">
                            <p className="font-medium">{item.productName}</p>
                            <p className="text-xs text-muted">{item.productCode}</p>
                          </td>
                          <td className="px-2 py-3">
                            <QuantityInput
                              aria-label={`Quantidade de ${item.productName}`}
                              itemName={item.productName}
                              value={item.quantity}
                              disabled={createMutation.isPending}
                              onChange={(value) => updateItem(item.productVariantId, 'quantity', value)}
                            />
                          </td>
                          {MONEY_FIELDS.map((field) => (
                            <td key={field.key} className="px-2 py-3">
                              <MoneyInput
                                aria-label={`${field.label} ${item.productName}`}
                                value={item[field.key]}
                                disabled={createMutation.isPending}
                                onChange={(event) => updateItem(item.productVariantId, field.key, event.target.value)}
                                aria-invalid={moneyFieldError(item[field.key]) ? 'true' : undefined}
                                className={cellInputClass}
                              />
                              {moneyFieldError(item[field.key]) && <p className="mt-1 text-xs text-danger">{moneyFieldError(item[field.key])}</p>}
                            </td>
                          ))}
                          <td data-testid={`item-total-${item.productVariantId}`} className={`px-2 py-3 font-medium ${total !== null && total < 0 ? 'text-danger' : ''}`}>
                            {total === null ? '—' : formatCents(total)}
                          </td>
                          <td className="px-2 py-3">
                            <button
                              type="button"
                              disabled={createMutation.isPending}
                              onClick={() => setItems((current) => current.filter((i) => i.productVariantId !== item.productVariantId))}
                              aria-label={`Remover ${item.productName}`}
                              className="rounded-lg p-2 text-danger hover:bg-danger-soft disabled:opacity-50"
                            >
                              <Trash2 size={17} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              ) : (
              <ul className="flex flex-col gap-3">
                {items.map((item, index) => {
                  const total = itemTotals[index];

                  return (
                    <li key={item.productVariantId} className="rounded-lg border border-input bg-surface text-foreground p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="break-words font-medium">{item.productName}</p>
                          <p className="text-xs text-muted">{item.productCode}</p>
                        </div>
                        <button
                          type="button"
                          disabled={createMutation.isPending}
                          onClick={() => setItems((current) => current.filter((i) => i.productVariantId !== item.productVariantId))}
                          aria-label={`Remover ${item.productName}`}
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-danger hover:bg-danger-soft disabled:opacity-50"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>

                      <div className="mt-3">
                        <QuantityInput
                          aria-label={`Quantidade de ${item.productName}`}
                          itemName={item.productName}
                          value={item.quantity}
                          disabled={createMutation.isPending}
                          onChange={(value) => updateItem(item.productVariantId, 'quantity', value)}
                        />
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-3">
                        {MONEY_FIELDS.map((field) => (
                          <div key={field.key}>
                            <label htmlFor={`${field.key}-${item.productVariantId}`} className="mb-1 block text-xs text-muted">
                              {field.header}
                            </label>
                            <MoneyInput
                              id={`${field.key}-${item.productVariantId}`}
                              aria-label={`${field.label} ${item.productName}`}
                              value={item[field.key]}
                              disabled={createMutation.isPending}
                              onChange={(event) => updateItem(item.productVariantId, field.key, event.target.value)}
                              aria-invalid={moneyFieldError(item[field.key]) ? 'true' : undefined}
                              className={cardMoneyClass}
                            />
                            {moneyFieldError(item[field.key]) && <p className="mt-1 text-xs text-danger">{moneyFieldError(item[field.key])}</p>}
                          </div>
                        ))}
                      </div>

                      <p className="mt-3 flex items-center justify-between border-t pt-3 text-sm">
                        <span className="text-muted">Total do item</span>
                        <span data-testid={`item-total-${item.productVariantId}`} className={`font-semibold ${total !== null && total < 0 ? 'text-danger' : ''}`}>
                          {total === null ? '—' : formatCents(total)}
                        </span>
                      </p>
                    </li>
                  );
                })}
              </ul>
              )
            )}

            {reason && (
              <div role="alert" className="mt-4 rounded-lg border border-warning/40 bg-warning-soft p-3 text-sm text-warning">
                {reason}
              </div>
            )}

            <div className="mt-5 flex flex-col gap-2 border-t pt-4 sm:items-end">
              <p className="text-sm text-muted">Total do pedido</p>
              <p data-testid="purchase-total" className="text-2xl font-semibold">
                {formatCents(totalCents)}
              </p>
            </div>

            <fieldset className="mt-6 border-t pt-5">
              <legend className="text-lg font-semibold">Condição de pagamento</legend>

              <div className="mt-3 flex flex-wrap gap-6">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="paymentMode"
                    checked={!isInstallments}
                    onChange={() => {
                      setPaymentMode('cash');
                      clearErrors('firstDueDate');
                    }}
                  />
                  À vista
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" name="paymentMode" checked={isInstallments} onChange={() => setPaymentMode('installments')} />
                  Parcelado
                </label>
              </div>

              {isInstallments && (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="purchase-installments" className="mb-1 block text-sm font-medium">
                      Número de parcelas
                    </label>
                    <select id="purchase-installments" value={installments} onChange={(event) => setInstallments(Number(event.target.value))} className={inputClass}>
                      {Array.from({ length: MAX_INSTALLMENTS - 1 }, (_, i) => i + 2).map((n) => (
                        <option key={n} value={n}>
                          {n}x
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="purchase-first-due" className="mb-1 block text-sm font-medium">
                      Primeiro vencimento
                    </label>
                    <input id="purchase-first-due" {...fieldA11y("purchase-first-due", errors.firstDueDate?.message)} type="date" min={purchaseDate || undefined} {...register('firstDueDate')} className={inputClass} />
                    <FieldError id="purchase-first-due" message={errors.firstDueDate?.message} />
                  </div>
                </div>
              )}

              {isInstallments && preview.length > 0 && (
                <ul data-testid="installments-preview" className="mt-4 divide-y rounded-lg border text-sm">
                  {preview.map((parcel, index) => (
                    <li key={index} className="flex justify-between px-3 py-2">
                      <span>
                        {index + 1}/{preview.length} · {formatDateOnly(parcel.dueDate)}
                      </span>
                      <span className="font-medium">{formatCents(parcel.amountCents)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </fieldset>

            <div className="mt-6 border-t pt-5">
              <label htmlFor="purchase-notes" className="mb-1 block text-sm font-medium">
                Observações
              </label>
              <textarea id="purchase-notes" {...fieldA11y("purchase-notes", errors.notes?.message)} rows={2} maxLength={500} {...register('notes')} className={inputClass} />
              <FieldError id="purchase-notes" message={errors.notes?.message} />
            </div>

            <div className="mt-6 flex flex-col-reverse justify-end gap-3 border-t pt-5 sm:flex-row">
              <Button type="button" variant="outline" disabled={createMutation.isPending} onClick={() => navigate('/purchases')}>
                Cancelar
              </Button>
              <Button type="button" onClick={() => void submit()} disabled={isSubmitDisabled}>
                {createMutation.isPending ? 'Registrando pedido...' : 'Registrar pedido'}
              </Button>
            </div>
          </section>
    </Page>
  );
}

