import { InternalErrorCodes, InternalInvariantError } from "@shared/domain/errors";
import { applyBps, ceilDiv, type Bps } from "@shared/domain/percent";

export interface CardFees {
  debitBps: Bps;
  /** Chaves 1..12. */
  creditBps: Record<number, Bps>;
}

export type CardKind = "DEBIT" | "CREDIT";

export function cardFeeBps(fees: CardFees, kind: CardKind, installments: number): Bps {
  if (kind === "DEBIT") return fees.debitBps;
  const fee =
    Number.isInteger(installments) && installments >= 1 && installments <= 12 ? fees.creditBps[installments] : undefined;
  if (fee === undefined) {
    throw new InternalInvariantError(
      `Parcelas de cartão inválidas: ${installments}.`,
      InternalErrorCodes.CARD_INSTALLMENTS_INVALID,
    );
  }
  return fee;
}

/** Preço com a taxa repassada ao cliente: sobe para o centavo seguinte. */
export function priceWithCardFee(baseCents: number, feeBps: Bps): number {
  return ceilDiv(baseCents * 10_000, 10_000 - feeBps);
}

/** Líquido recebido quando a loja absorve a taxa. */
export function netAfterCardFee(chargedCents: number, feeBps: Bps): number {
  return chargedCents - applyBps(chargedCents, feeBps);
}
