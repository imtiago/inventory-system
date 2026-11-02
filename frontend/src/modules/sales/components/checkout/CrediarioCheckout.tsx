import { TriangleAlert } from 'lucide-react';

import { StatusBadge } from '@/components/ui/badge';
import { FieldError, fieldA11y, MoneyInput } from '@/shared/components/form';
import { LoadingState } from '@/shared/components/LoadingState';
import { formatCurrency } from '@/shared/utils/money';
import { useCustomerCredit } from '@/modules/credit/hooks/useCredit';
import { CREDIT_STATUS_LABELS } from '@/modules/credit/types';

import type { CheckoutPaymentMethod, ISaleSimulationCrediario } from '../../types';
import { CREDIARIO_BLOCK_MESSAGES, DUE_DAYS, PAYMENT_METHOD_LABELS } from '../../utils/checkout';
import { CrediarioSimulationTable } from './CrediarioSimulationTable';
import { checkoutFieldClass, checkoutLabelClass } from './styles';

interface Props {
  customerId: string;
  crediario: ISaleSimulationCrediario | undefined;
  loading: boolean;
  downPaymentText: string;
  onDownPaymentTextChange: (text: string) => void;
  downPaymentError?: string;
  /** Entrada efetiva (digitada ou a mínima) > 0: pede a forma de pagamento. */
  hasDownPayment: boolean;
  downPaymentMethod: CheckoutPaymentMethod;
  onDownPaymentMethodChange: (method: CheckoutPaymentMethod) => void;
  dueDay: string;
  onDueDayChange: (day: string) => void;
  selected: number | null;
  onSelect: (installments: number) => void;
  showMargin: boolean;
  disabled: boolean;
}

/** Crediário: ficha do cliente, travas, entrada, forma da entrada, dia do vencimento e as opções. */
export function CrediarioCheckout(props: Props) {
  const { crediario, loading, disabled } = props;

  return (
    <div className="flex flex-col gap-5">
      <CustomerCreditPanel customerId={props.customerId} />

      {crediario?.blockedReason && (
        <div role="alert" className={`flex items-start gap-3 rounded-lg border p-3 text-sm ${crediario.blockedReason === 'OVERDUE' || crediario.blockedReason === 'LIMIT' ? 'border-warning/30 bg-warning-soft text-warning' : 'border-danger/30 bg-danger-soft text-danger'}`}>
          <TriangleAlert size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
          <p>{CREDIARIO_BLOCK_MESSAGES[crediario.blockedReason]}</p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="crediario-down-payment" className={checkoutLabelClass}>
            Entrada
          </label>
          <MoneyInput
            id="crediario-down-payment"
            {...fieldA11y('crediario-down-payment', props.downPaymentError)}
            aria-describedby={props.downPaymentError ? 'crediario-down-payment-error' : 'crediario-down-payment-hint'}
            value={props.downPaymentText}
            placeholder={crediario ? formatCurrency(crediario.minDownPayment).replace(/^R\$\s*/, '') : '0,00'}
            disabled={disabled}
            onChange={(event) => props.onDownPaymentTextChange(event.target.value)}
          />
          {props.downPaymentError ? (
            <FieldError id="crediario-down-payment" message={props.downPaymentError} />
          ) : (
            <p id="crediario-down-payment-hint" className="mt-1 text-xs text-muted">
              {crediario ? `Entrada mínima: ${formatCurrency(crediario.minDownPayment)}` : 'Entrada mínima conforme o perfil do cliente.'}
            </p>
          )}
        </div>

        {props.hasDownPayment && (
          <div>
            <label htmlFor="crediario-down-method" className={checkoutLabelClass}>
              Forma da entrada
            </label>
            <select id="crediario-down-method" className={checkoutFieldClass} value={props.downPaymentMethod} disabled={disabled} onChange={(event) => props.onDownPaymentMethodChange(event.target.value as CheckoutPaymentMethod)}>
              {(Object.keys(PAYMENT_METHOD_LABELS) as CheckoutPaymentMethod[]).map((method) => (
                <option key={method} value={method}>
                  {PAYMENT_METHOD_LABELS[method]}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label htmlFor="crediario-due-day" className={checkoutLabelClass}>
            Dia do vencimento
          </label>
          <select id="crediario-due-day" className={checkoutFieldClass} value={props.dueDay} disabled={disabled} onChange={(event) => props.onDueDayChange(event.target.value)}>
            <option value="">Padrão da loja</option>
            {DUE_DAYS.map((day) => (
              <option key={day} value={day}>
                Dia {day}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-base font-semibold">Opções de parcelamento</h3>
        {crediario ? (
          <CrediarioSimulationTable crediario={crediario} selected={props.selected} onSelect={props.onSelect} showMargin={props.showMargin} disabled={disabled} />
        ) : loading ? (
          <LoadingState label="Simulando o crediário..." />
        ) : (
          <p className="text-sm text-muted">Escolha o cliente e lance os produtos para ver as opções.</p>
        )}
      </div>
    </div>
  );
}

function CustomerCreditPanel({ customerId }: { customerId: string }) {
  const { data: credit, isLoading, isError } = useCustomerCredit(customerId);

  if (!customerId) return null;

  return (
    <div data-testid="customer-credit-panel" className="rounded-lg border bg-surface-muted p-4">
      <h3 className="mb-3 text-sm font-semibold">Crédito do cliente</h3>
      {isLoading ? (
        <LoadingState label="Carregando crédito..." />
      ) : isError || !credit ? (
        <p className="text-sm text-danger">Não foi possível carregar o crédito do cliente.</p>
      ) : (
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-muted">Perfil</dt>
            <dd className="font-medium">{credit.profileName}</dd>
          </div>
          <div>
            <dt className="text-muted">Limite</dt>
            <dd className="font-medium tabular-nums">{formatCurrency(credit.limit)}</dd>
          </div>
          <div>
            <dt className="text-muted">Disponível</dt>
            <dd className="font-medium tabular-nums">{formatCurrency(credit.available)}</dd>
          </div>
          <div>
            <dt className="text-muted">Situação</dt>
            <dd>
              <StatusBadge status={credit.status}>{CREDIT_STATUS_LABELS[credit.status]}</StatusBadge>
            </dd>
          </div>
          {credit.currentMaxOverdueDays > 0 && <p className="col-span-full text-danger">Parcela vencida há {credit.currentMaxOverdueDays} dias.</p>}
        </dl>
      )}
    </div>
  );
}
