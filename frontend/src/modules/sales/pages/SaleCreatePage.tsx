import { parseApiErrorSync } from '@/shared/services/parseApiError';
import { applyFieldErrors } from '@/shared/utils/applyFieldErrors';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Trash2, UserRound } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Page } from '@/shared/components/layout/Page';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { FormAutocomplete, QuantityInput } from '@/shared/components/form';
import { useBreakpoint } from '@/shared/hooks/useMediaQuery';
import { useCan } from '@/shared/auth/useCan';

import type { ICustomer } from '@/modules/customers/types';
import { useCustomerSearch } from '@/modules/customers/hooks/useCustomerSearch';
import { useProductByBarcode } from '@/modules/inventory/hooks/useProductByBarcode';

import { SaleBarcodeInput } from '../components/SaleBarcodeInput';
import { PaymentConditionPicker } from '../components/checkout/PaymentConditionPicker';
import { CardOptions } from '../components/checkout/CardOptions';
import { CrediarioCheckout } from '../components/checkout/CrediarioCheckout';
import { CheckoutSummary } from '../components/checkout/CheckoutSummary';
import { CreditOverrideModal } from '../components/checkout/CreditOverrideModal';
import { isQuantityValid, useSaleCart } from '../hooks/useSaleCart';
import { useCreateSale } from '../hooks/useCreateSale';
import { useSaleSimulation } from '../hooks/useSaleSimulation';
import { formatCents, formatCurrency, fromCents, parseMoneyToCents, toCents } from '@/shared/utils/money';
import type { CheckoutPaymentMethod, CreditOverrideKind, ICreditOverrideInput, SalePaymentCondition } from '../types';
import { buildPayment, CONDITION_LABELS, crediarioHardBlock, findCondition, isCard, overrideKindsFor } from '../utils/checkout';

type SaleFormValues = {
  customerId: string;
};

/** Erros do crediário que só passam com autorização de quem aprova crédito. */
const OVERRIDE_CODES: Record<string, CreditOverrideKind> = { CREDIT_LIMIT_EXCEEDED: 'LIMIT', CREDIT_OVERDUE_BLOCK: 'OVERDUE' };

/** Respostas que ficam no modal de autorização (senha errada, tentativas demais, dados inválidos). */
const OVERRIDE_MODAL_CODES = new Set(['CREDIT_OVERRIDE_DENIED', 'TOO_MANY_REQUESTS', 'VALIDATION_ERROR']);

type OverrideState = { open: boolean; reasons: CreditOverrideKind[]; notice: string | null; error: string | null };

const CLOSED_OVERRIDE: OverrideState = { open: false, reasons: [], notice: null, error: null };

export function SaleCreatePage() {
  const navigate = useNavigate();
  const isWide = useBreakpoint('md');
  const canSeeMargin = useCan('reports.profit');

  const { control, setError } = useForm<SaleFormValues>({
    defaultValues: {
      customerId: '',
    },
  });

  const customerId = useWatch({ control, name: 'customerId' });

  // Fechamento: condição e detalhes de cada uma.
  const [condition, setCondition] = useState<SalePaymentCondition>('CASH');
  const [passCardFee, setPassCardFee] = useState(true);
  const [cardInstallments, setCardInstallments] = useState(1);
  const [crediarioInstallments, setCrediarioInstallments] = useState<number | null>(null);
  const [downPaymentText, setDownPaymentText] = useState('');
  const [downPaymentError, setDownPaymentError] = useState<string | undefined>();
  const [downPaymentMethod, setDownPaymentMethod] = useState<CheckoutPaymentMethod>('CASH');
  const [dueDay, setDueDay] = useState('');
  const [override, setOverride] = useState<OverrideState>(CLOSED_OVERRIDE);

  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<ICustomer | null>(null);

  // Stock refusal of one item (409 EXPIRED_STOCK_ONLY / 422 INSUFFICIENT_STOCK with details.productVariantId).
  const [itemError, setItemError] = useState<{ productVariantId: string; message: string } | null>(null);

  // Barcode lookups (success/error) near the scanner; submit errors near the checkout actions.
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { data: customerData, isFetching: customersLoading, isError: customersError } = useCustomerSearch(customerSearch);

  const customers = customerData?.data ?? [];

  const customerOptions = selectedCustomer && !customers.some((customer) => customer.id === selectedCustomer.id) ? [selectedCustomer, ...customers] : customers;

  const cart = useSaleCart();

  const { loading: variantLoading, searchByBarcode } = useProductByBarcode();

  const createSaleMutation = useCreateSale();

  const hasUnpricedItems = cart.itemsWithoutPrice.length > 0;

  const saleItems = cart.items.map((item) => ({ productVariantId: item.productVariantId, quantity: item.quantity as number }));

  const isCrediario = condition === 'CREDIARIO';

  // Entrada digitada (centavos) ou null (vazia/inválida): vazia = mínima do perfil.
  const typedDownPaymentCents = parseMoneyToCents(downPaymentText);

  const canSimulate = Boolean(customerId) && cart.items.length > 0 && !cart.hasInvalidQuantity && !hasUnpricedItems;

  const simulation = useSaleSimulation(
    canSimulate
      ? {
          customerId,
          items: saleItems,
          ...(isCrediario && typedDownPaymentCents !== null ? { downPayment: fromCents(typedDownPaymentCents) } : {}),
        }
      : null,
  );

  const crediario = simulation.data?.crediario;
  const crediarioOption = crediario?.options.find((option) => option.installments === crediarioInstallments) ?? null;
  const crediarioBlocked = crediario ? crediarioHardBlock(crediario) : null;
  const neededOverride = isCrediario && crediario && crediarioOption ? overrideKindsFor(crediario, crediarioOption) : [];
  const downPaymentCents = typedDownPaymentCents ?? (crediario ? toCents(crediario.minDownPayment) : 0);

  const conditionRow = findCondition(simulation.data, { condition, cardInstallments, passCardFee });
  const cashPrice = simulation.data?.itemsTotal ?? fromCents(cart.totalCents);
  const checkoutTotal = isCrediario ? (crediarioOption?.total ?? null) : (conditionRow?.total ?? (simulation.data ? null : cashPrice));
  const checkoutMargin = canSeeMargin ? (isCrediario ? crediarioOption?.margin : conditionRow?.margin) : undefined;
  const conditionLabel = isCrediario
    ? `Crediário${crediarioOption ? ` ${crediarioOption.installments}x` : ''}`
    : condition === 'CREDIT_CARD'
      ? `Crédito ${cardInstallments}x`
      : CONDITION_LABELS[condition];

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

  /** Confere o carrinho e o fechamento: mensagem para o alerta, '' quando o erro já está no campo, null = ok. */
  function validate(): string | null {
    if (!customerId) return 'Selecione um cliente antes de registrar a venda.';
    if (cart.items.length === 0) return 'Adicione pelo menos um produto à venda.';
    if (cart.hasInvalidQuantity) return 'Informe uma quantidade válida (número inteiro maior que zero) para todos os itens.';
    if (hasUnpricedItems) return 'Há itens sem preço de venda. Cadastre o preço da variante antes de registrar a venda.';
    if (!isCrediario) return null;

    if (!crediario) return 'Aguarde a simulação do crediário.';
    if (downPaymentText.trim() !== '' && typedDownPaymentCents === null) {
      setDownPaymentError('Informe um valor válido (ex.: 50,00).');
      return '';
    }
    if (downPaymentCents < toCents(crediario.minDownPayment)) {
      setDownPaymentError(`A entrada mínima é ${formatCurrency(crediario.minDownPayment)}.`);
      return '';
    }
    if (downPaymentCents >= toCents(cashPrice)) {
      setDownPaymentError('A entrada deve ser menor que o total da venda.');
      return '';
    }
    if (!crediarioOption) return 'Escolha o número de parcelas do crediário.';

    return null;
  }

  function handleRegisterSale() {
    setFeedback(null);
    setSubmitError(null);
    setDownPaymentError(undefined);

    const problem = validate();
    if (problem !== null) {
      if (problem) setSubmitError(problem);
      return;
    }

    if (neededOverride.length > 0) {
      setOverride({ open: true, reasons: neededOverride, notice: null, error: null });
      return;
    }

    submit();
  }

  function submit(authorization?: ICreditOverrideInput) {
    if (createSaleMutation.isPending) return;

    setItemError(null);

    const payment = buildPayment({
      condition,
      cardInstallments,
      passCardFee,
      crediario:
        isCrediario && crediarioOption
          ? { installments: crediarioOption.installments, downPaymentCents, downPaymentMethod, dueDay: dueDay ? Number(dueDay) : null }
          : undefined,
    });

    createSaleMutation.mutate(
      { customerId, items: saleItems, payment: authorization ? { ...payment, override: authorization } : payment },
      {
        onSuccess: (sale) => {
          setOverride(CLOSED_OVERRIDE);
          navigate(`/sales/${sale.id}`);
        },
        onError: (error) => {
          const { fieldErrors, message, code, status, details } = parseApiErrorSync(error);

          // The axios interceptor already redirects to /login on 401.
          if (status === 401) return;

          // Limite/atraso: só com autorização de quem aprova crédito.
          const kind = OVERRIDE_CODES[code];
          if (kind && !authorization) {
            setOverride({ open: true, reasons: [kind], notice: message, error: null });
            return;
          }

          if (authorization && (OVERRIDE_MODAL_CODES.has(code) || kind)) {
            setOverride((current) => ({ ...current, error: message }));
            return;
          }

          setOverride(CLOSED_OVERRIDE);

          // Stock refusals name the sale item: shown on that item instead of the generic alert.
          if ((code === 'EXPIRED_STOCK_ONLY' || code === 'INSUFFICIENT_STOCK') && typeof details?.productVariantId === 'string') {
            const productVariantId = details.productVariantId;
            if (cart.items.some((item) => item.productVariantId === productVariantId)) {
              setItemError({ productVariantId, message });
              return;
            }
          }

          if (code === 'DOWN_PAYMENT_TOO_LOW') {
            setDownPaymentError(message);
            return;
          }

          // customerId renders inline; the down payment below its field; other paths have no input.
          const { 'payment.crediario.downPayment': downPaymentField, ...rest } = fieldErrors;
          if (downPaymentField) setDownPaymentError(downPaymentField);

          const { applied, unmatched } = applyFieldErrors(setError, rest, ['customerId']);

          const detail = Object.values(unmatched)[0];

          // Shown once: inline when fully mapped to a field, otherwise as the alert (never both).
          if ((applied.length > 0 || downPaymentField) && !detail) return;

          setSubmitError(code === 'UNKNOWN_ERROR' ? 'Não foi possível registrar a venda. Verifique os dados e tente novamente.' : detail ? `${message} ${detail}` : message);
        },
      },
    );
  }

  const isRegisterDisabled =
    !customerId || cart.items.length === 0 || hasUnpricedItems || createSaleMutation.isPending || (isCrediario && (!crediario || crediarioBlocked !== null));

  const registerLabel = createSaleMutation.isPending ? 'Registrando venda...' : neededOverride.length > 0 ? 'Pedir autorização' : 'Registrar venda';

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
              <p className="text-sm text-muted">Total dos itens (à vista)</p>
              <p data-testid="sale-total" className="text-xl font-semibold tabular-nums">
                {formatCents(cart.totalCents)}
              </p>
              <p data-testid="sale-total-estimate" className="text-xs text-muted">
                Estimativa com os preços lidos agora. O valor final é calculado ao registrar.
              </p>
            </div>

          </section>

          {/* Fechamento: condição de pagamento */}
          {cart.items.length > 0 && (
            <section aria-labelledby="checkout-title" className="flex flex-col gap-5 rounded-xl border bg-surface p-5 shadow sm:p-6">
              <h2 id="checkout-title" className="text-lg font-semibold">
                Fechamento
              </h2>

              <PaymentConditionPicker
                value={condition}
                disabled={createSaleMutation.isPending}
                onChange={(next) => {
                  setCondition(next);
                  setSubmitError(null);
                }}
              />

              {isCard(condition) && (
                <CardOptions
                  condition={condition as 'DEBIT_CARD' | 'CREDIT_CARD'}
                  passCardFee={passCardFee}
                  onPassCardFeeChange={setPassCardFee}
                  cardInstallments={cardInstallments}
                  onCardInstallmentsChange={setCardInstallments}
                  simulation={simulation.data}
                  disabled={createSaleMutation.isPending}
                />
              )}

              {isCrediario && (
                <CrediarioCheckout
                  customerId={customerId}
                  crediario={canSimulate ? crediario : undefined}
                  loading={simulation.isLoading}
                  downPaymentText={downPaymentText}
                  onDownPaymentTextChange={(text) => {
                    setDownPaymentText(text);
                    setDownPaymentError(undefined);
                  }}
                  downPaymentError={downPaymentError}
                  hasDownPayment={downPaymentCents > 0}
                  downPaymentMethod={downPaymentMethod}
                  onDownPaymentMethodChange={setDownPaymentMethod}
                  dueDay={dueDay}
                  onDueDayChange={setDueDay}
                  selected={crediarioInstallments}
                  onSelect={(installments) => {
                    setCrediarioInstallments(installments);
                    setSubmitError(null);
                  }}
                  showMargin={canSeeMargin}
                  disabled={createSaleMutation.isPending}
                />
              )}

              {simulation.isError && (
                <p role="alert" className="text-sm text-danger">
                  Não foi possível simular os valores. O servidor calcula o total ao registrar.
                </p>
              )}
            </section>
          )}

          {submitError && (
            <div role="alert" className="rounded-lg border border-danger/30 bg-danger-soft p-3 text-sm text-danger">
              {submitError}
            </div>
          )}

          {/* Total e ações: barra fixa no celular, cartão no fim da página a partir de md */}
          <div
            data-testid="checkout-bar"
            className="sticky bottom-0 z-20 -mx-3 flex flex-col gap-3 border-t bg-surface px-3 py-3 shadow-lg sm:-mx-4 sm:px-4 md:static md:mx-0 md:rounded-xl md:border md:p-6 md:shadow"
          >
            <CheckoutSummary cashPrice={cashPrice} total={cart.items.length > 0 ? checkoutTotal : null} conditionLabel={conditionLabel} margin={checkoutMargin} />

            <div className="flex flex-row-reverse gap-3 md:justify-start">
              <Button type="button" className="min-h-11 flex-1 md:flex-none" disabled={isRegisterDisabled} onClick={handleRegisterSale}>
                {registerLabel}
              </Button>
              <Button type="button" variant="outline" className="min-h-11" disabled={createSaleMutation.isPending} onClick={() => navigate('/sales')}>
                Cancelar
              </Button>
            </div>
          </div>

          <CreditOverrideModal
            open={override.open}
            reasons={override.reasons}
            notice={override.notice}
            error={override.error}
            pending={createSaleMutation.isPending}
            onSubmit={(authorization) => {
              setOverride((current) => ({ ...current, error: null }));
              submit(authorization);
            }}
            onClose={() => setOverride(CLOSED_OVERRIDE)}
          />
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
