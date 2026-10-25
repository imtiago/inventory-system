import { parseApiErrorSync } from '@/shared/services/parseApiError';
import { applyFieldErrors } from '@/shared/utils/applyFieldErrors';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Package, Trash2, UserRound } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Page } from '@/shared/components/layout/Page';
import { FormAutocomplete } from '@/shared/components/form';

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
          const { fieldErrors, message, code, status } = parseApiErrorSync(error);

          // The axios interceptor already redirects to /login on 401.
          if (status === 401) return;

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
    <Page>
      <div className="min-h-0 w-full flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-4 pb-8 sm:px-6">
          <header className="flex items-center gap-3">
            <Link to="/sales" aria-label="Voltar para vendas" className="rounded-lg border p-2 transition hover:bg-gray-50">
              <ArrowLeft size={20} />
            </Link>

            <div>
              <h1 className="text-2xl font-semibold">Nova venda</h1>
              <p className="mt-1 text-sm text-gray-500">Selecione o cliente e lance os produtos.</p>
            </div>
          </header>

          {/* Seleção do cliente */}
          <section className="rounded-xl border bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-5 flex items-start gap-3">
              <div className="rounded-lg bg-gray-100 p-2">
                <UserRound size={21} />
              </div>

              <div>
                <h2 className="text-lg font-semibold">Cliente da venda</h2>
                <p className="mt-1 text-sm text-gray-500">Pesquise pelo nome, e-mail ou telefone.</p>
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
              <p role="alert" className="mt-2 text-sm text-red-600">
                Não foi possível consultar os clientes.
              </p>
            )}

            {selectedCustomer && customerId === selectedCustomer.id && (
              <div className="mt-4 rounded-lg border bg-gray-50 p-3">
                <p className="text-sm font-medium">{selectedCustomer.name}</p>

                {selectedCustomer.email && <p className="mt-1 text-sm text-gray-500">{selectedCustomer.email}</p>}

                {selectedCustomer.phone && <p className="mt-1 text-sm text-gray-500">{selectedCustomer.phone}</p>}
              </div>
            )}
          </section>

          {/* Lançamento por código de barras */}
          <SaleBarcodeInput loading={variantLoading} onSubmitBarcode={handleBarcodeSubmit} />

          {feedback && (
            <div
              role={feedback.type === 'error' ? 'alert' : 'status'}
              className={`rounded-lg border p-3 text-sm ${feedback.type === 'success' ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-700'}`}
            >
              {feedback.message}
            </div>
          )}

          {/* Carrinho */}
          <section className="rounded-xl border bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Itens da venda</h2>
                <p className="mt-1 text-sm text-gray-500">
                  {cart.totalQuantity} unidade(s) · {cart.items.length} variante(s)
                </p>
              </div>

              <Button type="button" variant="outline" onClick={cart.clearItems} disabled={cart.items.length === 0 || createSaleMutation.isPending}>
                Limpar itens
              </Button>
            </div>

            {cart.items.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center">
                <Package className="mx-auto mb-3 text-gray-400" size={32} />
                <p className="font-medium">Nenhum produto lançado</p>
                <p className="mt-1 text-sm text-gray-500">Digite ou escaneie um código de barras para adicionar uma variante.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px] text-left text-sm">
                  <thead>
                    <tr className="border-b text-gray-500">
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
                          <p className="text-xs text-gray-500">{item.productCode}</p>
                        </td>

                        <td className="px-3 py-3">
                          <input
                            aria-label={`Quantidade de ${item.productName}`}
                            type="number"
                            min={1}
                            step={1}
                            value={item.quantity ?? ''}
                            disabled={createSaleMutation.isPending}
                            onChange={(event) => cart.updateQuantity(item.productVariantId, event.target.value === '' ? null : Number(event.target.value))}
                            className="w-20 rounded-md border px-2 py-1.5"
                          />
                        </td>

                        <td className="px-3 py-3">{item.unitPrice > 0 ? formatCurrency(item.unitPrice) : <span className="text-red-600">Sem preço</span>}</td>

                        <td className="px-3 py-3 font-medium">{isQuantityValid(item.quantity) ? formatCurrency(item.quantity * item.unitPrice) : '—'}</td>

                        <td className="px-3 py-3">
                          <button
                            type="button"
                            disabled={createSaleMutation.isPending}
                            onClick={() => cart.removeItem(item.productVariantId)}
                            aria-label={`Remover ${item.productName}`}
                            className="rounded-md p-2 text-red-600 hover:bg-red-50 disabled:opacity-50"
                          >
                            <Trash2 size={17} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {hasUnpricedItems && (
              <div role="alert" className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                {cart.itemsWithoutPrice.map((item) => item.productName).join(', ')}: sem preço de venda. Cadastre o preço da variante para registrar a venda.
              </div>
            )}

            <div className="mt-5 flex flex-col gap-2 border-t pt-4 sm:items-end">
              <p className="text-sm text-gray-500">Total</p>
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
                      className="w-full rounded-md border px-3 py-2"
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
                    <input id="sale-first-due" type="date" {...register('firstDueDate')} className="w-full rounded-md border px-3 py-2" />
                    {errors.firstDueDate && <p className="mt-1 text-sm text-red-600">{errors.firstDueDate.message}</p>}
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
        </div>
      </div>
    </Page>
  );
}
