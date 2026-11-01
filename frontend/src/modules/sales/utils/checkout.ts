import { toCents } from '@/shared/utils/money';

import type {
  CheckoutPaymentMethod,
  CrediarioBlockedReason,
  CreditOverrideKind,
  ISaleDetail,
  ISalePaymentInput,
  ISaleSimulation,
  ISaleSimulationCondition,
  ISaleSimulationCrediario,
  ISaleSimulationCrediarioOption,
  SalePaymentCondition,
} from '../types';

export const CONDITION_LABELS: Record<SalePaymentCondition, string> = {
  CASH: 'Dinheiro',
  PIX: 'PIX',
  DEBIT_CARD: 'Débito',
  CREDIT_CARD: 'Crédito',
  CREDIARIO: 'Crediário',
};

export const CHECKOUT_CONDITIONS: SalePaymentCondition[] = ['CASH', 'PIX', 'DEBIT_CARD', 'CREDIT_CARD', 'CREDIARIO'];

export const PAYMENT_METHOD_LABELS: Record<CheckoutPaymentMethod, string> = {
  CASH: 'Dinheiro',
  PIX: 'PIX',
  DEBIT_CARD: 'Cartão de débito',
  CREDIT_CARD: 'Cartão de crédito',
};

export const OVERRIDE_KIND_LABELS: Record<CreditOverrideKind, string> = { LIMIT: 'Limite', OVERDUE: 'Atraso' };

export const CARD_INSTALLMENTS = Array.from({ length: 12 }, (_, i) => i + 1);

export const DUE_DAYS = Array.from({ length: 28 }, (_, i) => i + 1);

/** Rótulo da condição gravada na venda (detalhe). */
export function saleConditionLabel(sale: Pick<ISaleDetail, 'paymentCondition' | 'cardInstallments'>): string {
  if (sale.paymentCondition === 'LEGACY_INSTALLMENTS') return 'Parcelado (antigo)';
  if (sale.paymentCondition === 'CREDIT_CARD') return `Crédito ${sale.cardInstallments ?? 1}x`;
  return CONDITION_LABELS[sale.paymentCondition];
}

export const isCard = (condition: SalePaymentCondition) => condition === 'DEBIT_CARD' || condition === 'CREDIT_CARD';

/** Linha da simulação para a condição escolhida (à vista, débito e crédito Nx com ou sem repasse). */
export function findCondition(
  simulation: ISaleSimulation | undefined,
  choice: { condition: SalePaymentCondition; cardInstallments: number; passCardFee: boolean },
): ISaleSimulationCondition | undefined {
  if (!simulation || choice.condition === 'CREDIARIO') return undefined;

  return simulation.conditions.find(
    (row) =>
      row.condition === choice.condition &&
      (choice.condition !== 'CREDIT_CARD' || row.cardInstallments === choice.cardInstallments) &&
      (!isCard(choice.condition) || row.passCardFee === choice.passCardFee),
  );
}

/** Travas sem exceção na venda: crediário desligado ou ficha bloqueada/suspensa. */
export function crediarioHardBlock(crediario: ISaleSimulationCrediario): 'DISABLED' | 'SUSPENDED' | null {
  return crediario.blockedReason === 'DISABLED' || crediario.blockedReason === 'SUSPENDED' ? crediario.blockedReason : null;
}

/**
 * Exceções que a opção precisa para passar (autorização com senha de quem aprova crédito):
 * atraso vale para a venda inteira; limite compara Σ parcelas (total − entrada) com o disponível,
 * a mesma conta do servidor.
 */
export function overrideKindsFor(crediario: ISaleSimulationCrediario, option: ISaleSimulationCrediarioOption): CreditOverrideKind[] {
  if (crediarioHardBlock(crediario)) return [];

  const kinds: CreditOverrideKind[] = [];
  if (crediario.blockedReason === 'OVERDUE') kinds.push('OVERDUE');
  if (toCents(option.total) - toCents(option.downPayment) > toCents(crediario.available)) kinds.push('LIMIT');

  return kinds;
}

/** Motivo curto mostrado na opção (esmaecida). */
export const OPTION_BLOCK_LABELS: Record<CrediarioBlockedReason, string> = {
  DISABLED: 'Crediário desligado',
  SUSPENDED: 'Crédito suspenso',
  OVERDUE: 'Parcela em atraso',
  LIMIT: 'Acima do disponível',
};

/** Motivo de cada opção: trava sem exceção primeiro, depois o que pede autorização. */
export function optionBlockReason(crediario: ISaleSimulationCrediario, option: ISaleSimulationCrediarioOption): CrediarioBlockedReason | null {
  return crediarioHardBlock(crediario) ?? overrideKindsFor(crediario, option)[0] ?? null;
}

/** Explicação completa (aviso acima das opções e modal de autorização). */
export const CREDIARIO_BLOCK_MESSAGES: Record<CrediarioBlockedReason, string> = {
  DISABLED: 'O crediário ainda não foi ativado nas configurações.',
  SUSPENDED: 'O crédito deste cliente está bloqueado ou suspenso. Venda no crediário não é possível.',
  OVERDUE: 'Cliente com parcela em atraso: a venda no crediário precisa de autorização.',
  LIMIT: 'Valor acima do disponível do cliente: a venda no crediário precisa de autorização.',
};

export interface CheckoutChoice {
  condition: SalePaymentCondition;
  cardInstallments: number;
  passCardFee: boolean;
  crediario?: { installments: number; downPaymentCents: number; downPaymentMethod: CheckoutPaymentMethod; dueDay: number | null };
}

/** Corpo `payment` do POST /sales: só os campos da condição escolhida. */
export function buildPayment(choice: CheckoutChoice): ISalePaymentInput {
  switch (choice.condition) {
    case 'DEBIT_CARD':
      return { condition: 'DEBIT_CARD', passCardFee: choice.passCardFee };
    case 'CREDIT_CARD':
      return { condition: 'CREDIT_CARD', cardInstallments: choice.cardInstallments, passCardFee: choice.passCardFee };
    case 'CREDIARIO': {
      const plan = choice.crediario;
      if (!plan) throw new Error('Plano do crediário ausente.');
      return {
        condition: 'CREDIARIO',
        crediario: {
          installments: plan.installments,
          downPayment: plan.downPaymentCents / 100,
          ...(plan.downPaymentCents > 0 ? { downPaymentMethod: plan.downPaymentMethod } : {}),
          ...(plan.dueDay ? { dueDay: plan.dueDay } : {}),
        },
      };
    }
    default:
      return { condition: choice.condition };
  }
}

/**
 * Parcelas do plano do crediário no documento a receber: a entrada é a parcela de hoje,
 * antes do primeiro vencimento do plano.
 */
export function planParcels(sale: ISaleDetail) {
  const parcels = sale.receivable?.parcels ?? [];
  const firstDue = sale.financing?.firstDueDate;

  return firstDue ? parcels.filter((parcel) => parcel.dueDate >= firstDue) : parcels;
}

/**
 * Pagamento que impede o cancelamento: só o de parcela. O pago no fechamento (à vista, cartão,
 * entrada do crediário) é estornado pelo próprio cancelamento (até 7 dias, regra do servidor).
 */
export function hasInstallmentPayments(sale: ISaleDetail): boolean {
  const parcels = sale.receivable?.parcels ?? [];
  if (sale.paymentCondition === 'LEGACY_INSTALLMENTS') return parcels.some((parcel) => parcel.paidAmount > 0);
  if (sale.paymentCondition === 'CREDIARIO') return planParcels(sale).some((parcel) => parcel.paidAmount > 0);

  return false;
}
