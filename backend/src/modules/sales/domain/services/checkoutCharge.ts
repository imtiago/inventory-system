import { cardFeeBps, priceWithCardFee, type CardFees } from "@pricing/domain/cardFees";
import type { Bps } from "@shared/domain/percent";
import { ImmediatePaymentCondition, PaymentCondition } from "../enums/PaymentCondition";

export interface CheckoutChargeInput {
  itemsTotalCents: number;
  condition: ImmediatePaymentCondition;
  /** 1..12, só CREDIT_CARD. */
  cardInstallments?: number | null;
  /** Repassar a taxa do cartão ao cliente (padrão: sim). Ignorado fora do cartão. */
  passCardFee?: boolean;
  cardFees: CardFees;
}

export interface CheckoutCharge {
  totalCents: number;
  /** total − itens (repasse da taxa); 0 sem repasse. */
  surchargeCents: number;
  /** Taxa do cartão aplicada; null fora do cartão. */
  cardFeeBps: Bps | null;
  cardFeePassedOn: boolean;
  cardInstallments: number | null;
}

/**
 * Valor cobrado numa condição à vista: dinheiro/PIX = itens; cartão com repasse =
 * itens ÷ (1 − taxa) para o centavo de cima; sem repasse = itens (a loja absorve a taxa).
 */
export function checkoutCharge(input: CheckoutChargeInput): CheckoutCharge {
  const isCard = input.condition === PaymentCondition.DEBIT_CARD || input.condition === PaymentCondition.CREDIT_CARD;
  if (!isCard) {
    return {
      totalCents: input.itemsTotalCents,
      surchargeCents: 0,
      cardFeeBps: null,
      cardFeePassedOn: false,
      cardInstallments: null,
    };
  }
  const installments = input.condition === PaymentCondition.CREDIT_CARD ? (input.cardInstallments ?? 1) : null;
  const fee = cardFeeBps(input.cardFees, installments === null ? "DEBIT" : "CREDIT", installments ?? 1);
  const passOn = input.passCardFee ?? true;
  const totalCents = passOn ? priceWithCardFee(input.itemsTotalCents, fee) : input.itemsTotalCents;
  return {
    totalCents,
    surchargeCents: totalCents - input.itemsTotalCents,
    cardFeeBps: fee,
    cardFeePassedOn: passOn,
    cardInstallments: installments,
  };
}
