import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { InternalErrorCodes, InternalInvariantError } from "@shared/domain/errors";
import type { CardFees } from "@pricing/domain/cardFees";

const bps = z.number().int().min(0).max(9999);
const storedSchema = z.object({
  debitBps: bps,
  creditBps: z.object(Object.fromEntries(Array.from({ length: 12 }, (_, i) => [String(i + 1), bps]))),
});

export const ZERO_CARD_FEES: CardFees = {
  debitBps: 0,
  creditBps: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [i + 1, 0])),
};

/** Valida o JSON do banco; inválido → erro interno (nunca devolve taxa "chutada"). */
export function parseStoredCardFees(json: unknown): CardFees {
  const parsed = storedSchema.safeParse(json);
  if (!parsed.success) {
    throw new InternalInvariantError("Taxas de cartão inválidas no banco.", InternalErrorCodes.PRICING_CARD_FEES_INVALID);
  }
  const creditBps: Record<number, number> = {};
  for (let i = 1; i <= 12; i++) creditBps[i] = (parsed.data.creditBps as Record<string, number>)[String(i)];
  return { debitBps: parsed.data.debitBps, creditBps };
}

export function serializeCardFees(fees: CardFees): Prisma.InputJsonObject {
  const creditBps: Record<string, number> = {};
  for (let i = 1; i <= 12; i++) creditBps[String(i)] = fees.creditBps[i];
  return { debitBps: fees.debitBps, creditBps };
}
