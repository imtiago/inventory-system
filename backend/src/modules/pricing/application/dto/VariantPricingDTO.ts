import { bpsToPercent, type Bps } from "@shared/domain/percent";
import { fromCents } from "@shared/domain/money";
import type { Cost4 } from "@shared/domain/cost4";
import { cardFeeBps, priceWithCardFee, type CardFees } from "@pricing/domain/cardFees";
import { realMargin } from "@pricing/domain/pricingMath";

export type TargetMarginSource = "VARIANT" | "PRODUCT" | "CATEGORY" | "STORE";

export interface MarginDTO {
  amount: number;
  percent: number;
}

export interface PaymentSimulationDTO {
  condition: "CASH" | "DEBIT" | "CREDIT";
  installments: number;
  passOn: boolean;
  price: number;
  margin: MarginDTO;
}

export interface VariantPricingDTO {
  variantId: string;
  averageCost: number;
  expensesPercent: number;
  expensesAmount: number;
  targetMarginPercent: number;
  targetMarginSource: TargetMarginSource;
  suggestedPrice: number | null;
  salePrice: number;
  realMargin: MarginDTO;
  supplierSuggestedPrice: number | null;
  supplierSuggestedPriceUpdatedAt: string | null;
  supplierMargin: MarginDTO | null;
  simulations: PaymentSimulationDTO[];
}

function toMarginDTO(m: { marginCents: number; marginBps: Bps }): MarginDTO {
  return { amount: fromCents(m.marginCents), percent: bpsToPercent(m.marginBps) };
}

export function buildMargin(input: {
  priceCents: number;
  averageCost4: Cost4;
  expensesBps: Bps;
  cardFeeBps?: Bps;
  chargedCents?: number;
}): MarginDTO {
  return toMarginDTO(realMargin({ ...input, unitCost4: input.averageCost4 }));
}

export function buildSimulations(input: {
  salePriceCents: number;
  averageCost4: Cost4;
  expensesBps: Bps;
  cardFees: CardFees;
}): PaymentSimulationDTO[] {
  const { salePriceCents: price, averageCost4, expensesBps, cardFees } = input;
  const out: PaymentSimulationDTO[] = [
    {
      condition: "CASH",
      installments: 1,
      passOn: false,
      price: fromCents(price),
      margin: buildMargin({ priceCents: price, averageCost4, expensesBps }),
    },
  ];
  const card = (condition: "DEBIT" | "CREDIT", installments: number) => {
    const fee = cardFeeBps(cardFees, condition, installments);
    out.push({
      condition,
      installments,
      passOn: false,
      price: fromCents(price),
      margin: buildMargin({ priceCents: price, averageCost4, expensesBps, cardFeeBps: fee }),
    });
    const charged = priceWithCardFee(price, fee);
    out.push({
      condition,
      installments,
      passOn: true,
      price: fromCents(charged),
      margin: buildMargin({ priceCents: price, averageCost4, expensesBps, cardFeeBps: fee, chargedCents: charged }),
    });
  };
  card("DEBIT", 1);
  for (let n = 1; n <= 12; n++) card("CREDIT", n);
  return out;
}

