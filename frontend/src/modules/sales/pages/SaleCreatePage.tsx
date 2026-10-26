import { parseApiErrorSync } from '@/shared/services/parseApiError';
import { applyFieldErrors } from '@/shared/utils/applyFieldErrors';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Trash2, UserRound } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Page } from '@/shared/components/layout/Page';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { FormAutocomplete, QuantityInput, FieldError, fieldA11y } from '@/shared/components/form';
import { useBreakpoint } from '@/shared/hooks/useMediaQuery';

import type { ICustomer } from '@/modules/customers/types';
import { useCustomerSearch } from '@/modules/customers/hooks/useCustomerSearch';
import { useProductByBarcode } from '@/modules/inventory/hooks/useProductByBarcode';

import { SaleBarcodeInput } from '../components/SaleBarcodeInput';
import { isQuantityValid, useSaleCart } from '../hooks/useSaleCart';
import { useCreateSale } from '../hooks/useCreateSale';
import { addDaysToDateOnly, buildInstallments } from '../utils/installments';
import { formatCents, formatCurrency } from '@/shared/utils/money';
import { todayInBusinessTz } from '@/shared/utils/businessDate';
import { formatDateOnly } from '@/shared/utils/formatDateOnly';

type SaleFormValues = {
  customerId: string;
  firstDueDate: string;
};

type PaymentMode = 'cash' | 'installments';

const MAX_INSTALLMENTS = 12;
const DEFAULT_FIRST_DUE_DAYS = 30;

export function SaleCreatePage() {
  const navigate = useNavigate();
  const isWide = useBreakpoint('md');

  const {
    control,
    setError,
    clearErrors,
    register,
    formState: { errors },
  } = useForm<SaleFormValues>({
    defaultValues: {
      customerId: '',
      firstDueDate: addDaysToDateOnly(todayInBusinessTz(), DEFAULT_FIRST_DUE_DAYS),
    },
  });

  const customerId = useWatch({ control, name: 'customerId' });
  const firstDueDate = useWatch({ control, name: 'firstDueDate' });

  const [paymentMode, setPaymentMode] = useState<PaymentMode>('cash');
  const [installments, setInstallments] = useState(2);

  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<ICustomer | null>(null);

  // Stock refusal of one item (409 EXPIRED_STOCK_ONLY / 422 INSUFFICIENT_STOCK with details.productVariantId).
  const [itemError, setItemError] = useState<{ productVariantId: string; message: string } | null>(null);

  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const { data: customerData, isFetching: customersLoading, isError: customersError } = useCustomerSearch(customerSearch);

  const customers = customerData?.data ?? [];

  const customerOptions = selectedCustomer && !customers.some((customer) => customer.id === selectedCustomer.id) ? [selectedCustomer, ...customers] : customers;

  const cart = useSaleCart();

  const { loading: variantLoading, searchByBarcode } = useProductByBarcode();

  const createSaleMutation = useCreateSale();

  const isInstallments = paymentMode === 'installments';

  async function handleBarcodeSubmit(barcode: string) {
    setFeedback(null);

    const variant = await searchByBarcode(barcode);

    if (!variant) {
      setFeedback({
        type: 'error',
        message: 'Variante não encontrada. Confira o código de barras e tente novamente.',
      });
      return;
    }

    cart.addVariant(variant);

    setFeedback(
      variant.salePrice && variant.salePrice > 0
        ? { type: 'success', message: `${variant.name} adicionado à venda.` }
        : null,
    );
  }

  function handleRegisterSale() {
    setFeedback(null);

    if (!customerId) {
      setFeedback({
        type: 'error',
        message: 'Selecione um cliente antes de registrar a venda.',
      });
      return;
    }

    if (cart.items.length === 0) {
      setFeedback({
        type: 'error',
        message: 'Adicione pelo menos um produto à venda.',
      });
      return;
    }

    if (cart.hasInvalidQuantity) {
      setFeedback({
        type: 'error',
        message: 'Informe uma quantidade válida (número inteiro maior que zero) para todos os itens.',
      });
      return;
    }

    if (cart.itemsWithoutPrice.length > 0) {
      setFeedback({
        type: 'error',
        message: 'Há itens sem preço de venda. Cadastre o preço da variante antes de registrar a venda.',
      });
      return;
    }

    if (isInstallments && !/^\d{4}-\d{2}-\d{2}$/.test(firstDueDate)) {
      setError('firstDueDate', { type: 'validate', message: 'Informe a data do primeiro vencimento.' });
      return;
    }

    if (isInstallments && firstDueDate < todayInBusinessTz()) {
      setError('firstDueDate', { type: 'validate', message: 'O primeiro vencimento não pode ser anterior a hoje.' });
      return;
    }

    if (createSaleMutation.isPending) {
      return;
    }

    setItemError(null);

    createSaleMutation.mutate(
      {
        customerId,
        items: cart.items.map((item) => ({
          productVariantId: item.productVariantId,
          quantity: item.quantity as number,
        })),
        paymentTerms: isInstallments ? { installments, firstDueDate } : { installments: 1 },
      },
      {
        onSuccess: (sale) => {
          navigate(`/sales/${sale.id}`);
        },
        onError: (error) => {
          const { fieldErrors, message, code, status, details } = parseApiErrorSync(error);

          // The axios interceptor already redirects to /login on 401.
          if (status === 401) return;

          // Stock refusals name the sale item: shown on that item instead of the generic alert.
          if ((code === 'EXPIRED_STOCK_ONLY' || code === 'INSUFFICIENT_STOCK') && typeof details?.productVariantId === 'string') {
            const productVariantId = details.productVariantId;
            if (cart.items.some((item) => item.productVariantId === productVariantId)) {
              setItemError({ productVariantId, message });
              return;
            }
          }

          // customerId / firstDueDate render inline; other paths (e.g. items.0.quantity) have no input.
          const mapped: Record<string, string> = {};
          for (const [field, text] of Object.entries(fieldErrors)) {
            mapped[field === 'paymentTerms.firstDueDate' ? 'firstDueDate' : field] = text;
          }

          const { applied, unmatched } = applyFieldErrors(setError, mapped, ['customerId', 'firstDueDate']);

          const detail = Object.values(unmatched)[0];

          // Shown once: inline when fully mapped to a field, otherwise as the alert (never both).
          if (applied.length > 0 && !detail) return;

          setFeedback({
            type: 'error',
            message: code === 'UNKNOWN_ERROR' ? 'Não foi possível registrar a venda. Verifique os dados e tente novamente.' : detail ? `${message} ${detail}` : message,
          });
        },
      },
    );
  }

  const hasUnpricedItems = cart.itemsWithoutPrice.length > 0;

  const isRegisterDisabled = !customerId || cart.items.length === 0 || hasUnpricedItems || createSaleMutation.isPending;

  const canPreview = isInstallments && cart.totalCents > 0 && !cart.hasInvalidQuantity && /^\d{4}-\d{2}-\d{2}$/.test(firstDueDate);

  const preview = canPreview ? buildInstallments(cart.totalCents, installments, firstDueDate) : [];

  return (
    <Page width="narrow">
      <PageHeader title="Nova venda" description="Selecione o cliente e lance os produtos." backPath="/sales" backLabel="vendas" />

          {/* Seleção do cliente */}
          <section className="rounded-xl border bg-surface p-5 shadow sm:p-6">
            <div className="mb-5 flex items-start gap-3">
              <div className="rounded-lg bg-surface-muted p-2">
                <UserRound size={21} />
              </div>

              <div>
                <h2 className="text-lg font-semibold">Cliente da venda</h2>
                <p className="mt-1 text-sm text-muted">Pesquise pelo nome, e-mail ou telefone.</p>
              </div>
            </div>

            <FormAutocomplete<SaleFormValues, ICustomer, string, 'customerId'>
              control={control}
              name="customerId"
              label="Cliente"
              placeholder="Digite o nome do cliente..."
              options={customerOptions}
              getOptionValue={(customer) => customer.id}
              getOptionLabel={(customer) => customer.name}
              getOptionDescription={(customer) => [customer.email, customer.phone].filter(Boolean).join(' · ')}
              onSearchChange={setCustomerSearch}
              onOptionChange={(customer) => setSelectedCustomer(customer)}
              minSearchLength={2}
              loading={customersLoading}
              emptyMessage="Nenhum cliente encontrado."
              required
              rules={{ required: 'Selecione um cliente.' }}
            />

            {customersError && (
              <p role="alert" className="mt-2 text-sm text-danger">
                Não foi possível consultar os clientes.
              </p>
            )}

            {selectedCustomer && customerId === selectedCustomer.id && (
              <div className="mt-4 rounded-lg border bg-surface-muted p-3">
                <p className="text-sm font-medium">{selectedCustomer.name}</p>

                {selectedCustomer.email && <p className="mt-1 text-sm text-muted">{selectedCustomer.email}</p>}

                {selectedCustomer.phone && <p className="mt-1 text-sm text-muted">{selectedCustomer.phone}</p>}
              </div>
            )}
          </section>

          {/* Lançamento por código de barras */}
          <SaleBarcodeInput loading={variantLoading} onSubmitBarcode={handleBarcodeSubmit} />

          {feedback && (
            <div
              role={feedback.type === 'error' ? 'alert' : 'status'}
              className={`rounded-lg border p-3 text-sm ${feedback.type === 'success' ? 'border-success/30 bg-success-soft text-success' : 'border-danger/30 bg-danger-soft text-danger'}`}
            >
              {feedback.message}
            </div>
          )}

          {/* Carrinho */}
          <section className="rounded-xl border bg-surface p-5 shadow sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Itens da venda</h2>
                <p className="mt-1 text-sm text-muted">
                  {cart.totalQuantity} unidade(s) · {cart.items.length} variante(s)
                </p>
              </div>

              <Button type="button" variant="outline" onClick={cart.clearItems} disabled={cart.items.length === 0 || createSaleMutation.isPending}>
                Limpar itens
              </Button>
            </div>

            {cart.items.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center">
                <Package className="mx-auto mb-3 text-subtle" size={32} />
                <p className="font-medium">Nenhum produto lançado</p>
                <p className="mt-1 text-sm text-muted">Digite ou escaneie um código de barras para adicionar uma variante.</p>
              </div>
            ) : (
              isWide ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px] text-left text-sm">
                  <thead>
                    <tr className="border-b text-muted">
                      <th className="px-3 py-3 font-medium">Variante</th>
                      <th className="px-3 py-3 font-medium">Quantidade</th>
                      <th className="px-3 py-3 font-medium">Preço unitário</th>
                      <th className="px-3 py-3 font-medium">Subtotal</th>
                      <th className="px-3 py-3 font-medium">Ações</th>
                    </tr>
                  </thead>

                  <tbody>
                    {cart.items.map((item) => (
                      <tr key={item.productVariantId} className="border-b last:border-0">
                        <td className="px-3 py-3">
                          <p className="font-medium">{item.productName}</p>
                          <p className="text-xs text-muted">{item.productCode}</p>
                          <ItemError itemError={itemError} productVariantId={item.productVariantId} />
                        </td>

                        <td className="px-3 py-3">
                          <QuantityInput
                            aria-label={`Quantidade de ${item.productName}`}
                            itemName={item.productName}
                            value={item.quantity === null ? '' : String(item.quantity)}
                            disabled={createSaleMutation.isPending}
                            onChange={(value) => cart.updateQuantity(item.productVariantId, value === '' ? null : Number(value))}
                          />
                        </td>

                        <td className="px-3 py-3">{item.unitPrice > 0 ? formatCurrency(item.unitPrice) : <span className="text-danger">Sem preço</span>}</td>

                        <td className="px-3 py-3 font-medium">{isQuantityValid(item.quantity) ? formatCurrency(item.quantity * item.unitPrice) : '—'}</td>

                        <td className="px-3 py-3">
                          <button
                            type="button"
                            disabled={createSaleMutation.isPending}
                            onClick={() => cart.removeItem(item.productVariantId)}
                            aria-label={`Remover ${item.productName}`}
                            className="rounded-lg p-2 text-danger hover:bg-danger-soft disabled:opacity-50"
                          >
                            <Trash2 size={17} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              ) : (
              <ul className="flex flex-col gap-3">
                {cart.items.map((item) => (
                  <li key={item.productVariantId} className="rounded-lg border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="break-words font-medium">{item.productName}</p>
                        <p className="text-xs text-muted">{item.productCode}</p>
                        <ItemError itemError={itemError} productVariantId={item.productVariantId} />
                      </div>
                      <button
                        type="button"
                        disabled={createSaleMutation.isPending}
                        onClick={() => cart.removeItem(item.productVariantId)}
                        aria-label={`Remover ${item.productName}`}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-danger hover:bg-danger-soft disabled:opacity-50"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                      <QuantityInput
                        aria-label={`Quantidade de ${item.productName}`}
                        itemName={item.productName}
                        value={item.quantity === null ? '' : String(item.quantity)}
                        disabled={createSaleMutation.isPending}
                        onChange={(value) => cart.updateQuantity(item.productVariantId, value === '' ? null : Number(value))}
                      />
                      <div className="text-right text-sm">
                        <p className="text-muted">{item.unitPrice > 0 ? formatCurrency(item.unitPrice) : <span className="text-danger">Sem preço</span>}</p>
                        <p className="font-semibold">{isQuantityValid(item.quantity) ? formatCurrency(item.quantity * item.unitPrice) : '—'}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              )
            )}

            {hasUnpricedItems && (
              <div role="alert" className="mt-4 rounded-lg border border-warning/40 bg-warning-soft p-3 text-sm text-warning">
                {cart.itemsWithoutPrice.map((item) => item.productName).join(', ')}: sem preço de venda. Cadastre o preço da variante para registrar a venda.
              </div>
            )}

            <div className="mt-5 flex flex-col gap-2 border-t pt-4 sm:items-end">
              <p className="text-sm text-muted">Total</p>
              <p data-testid="sale-total" className="text-2xl font-semibold">
                {formatCents(cart.totalCents)}
              </p>
            </div>

            {/* Condição de pagamento */}
            <fieldset className="mt-6 border-t pt-5">
              <legend className="text-lg font-semibold">Condição de pagamento</legend>

              <div className="mt-3 flex flex-wrap gap-6">
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" name="paymentMode" checked={!isInstallments} onChange={() => { setPaymentMode('cash'); clearErrors('firstDueDate'); }} />
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
                    <label htmlFor="sale-installments" className="mb-1 block text-sm font-medium">
                      Número de parcelas
                    </label>
                    <select
                      id="sale-installments"
                      value={installments}
                      onChange={(event) => setInstallments(Number(event.target.value))}
                      className="w-full rounded-lg border px-3 py-2"
                    >
                      {Array.from({ length: MAX_INSTALLMENTS - 1 }, (_, i) => i + 2).map((n) => (
                        <option key={n} value={n}>
                          {n}x
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="sale-first-due" className="mb-1 block text-sm font-medium">
                      Primeiro vencimento
                    </label>
                    <input id="sale-first-due" {...fieldA11y("sale-first-due", errors.firstDueDate?.message)} type="date" {...register('firstDueDate')} className="w-full rounded-lg border px-3 py-2" />
                    <FieldError id="sale-first-due" message={errors.firstDueDate?.message} />
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

            {/* Ações da venda */}
            <div className="mt-6 flex flex-col-reverse justify-end gap-3 border-t pt-5 sm:flex-row">
              <Button type="button" variant="outline" disabled={createSaleMutation.isPending} onClick={() => navigate('/sales')}>
                Cancelar
              </Button>

              <Button type="button" disabled={isRegisterDisabled} onClick={handleRegisterSale}>
                {createSaleMutation.isPending ? 'Registrando venda...' : 'Registrar venda'}
              </Button>
            </div>
          </section>
    </Page>
  );
}

function ItemError({ itemError, productVariantId }: { itemError: { productVariantId: string; message: string } | null; productVariantId: string }) {
  if (itemError?.productVariantId !== productVariantId) return null;

  return (
    <p role="alert" data-testid={`item-error-${productVariantId}`} className="mt-1 text-sm text-danger">
      {itemError.message}
    </p>
  );
}
