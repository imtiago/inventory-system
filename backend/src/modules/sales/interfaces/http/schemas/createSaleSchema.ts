import { z } from "zod";
import { MAX_AMOUNT, MAX_QUANTITY, MAX_SALE_ITEMS } from "@shared/domain/limits";

/** No máximo 2 casas decimais (robusto a erro de float, ex.: 0.1 + 0.2). */
const hasAtMostTwoDecimals = (v: number) => Number.isInteger(Number((v * 100).toPrecision(15)));

const saleItemSchema = z.object({
  productVariantId: z.string({ error: "Informe a variante." }).uuid("Variante inválida."),
  quantity: z
    .number({ error: "A quantidade deve ser um número." })
    .int("A quantidade deve ser um número inteiro.")
    .positive("A quantidade deve ser maior que zero.")
    .max(MAX_QUANTITY, "Quantidade excede o máximo permitido."),
});

const saleItemsSchema = z
  .array(saleItemSchema, { error: "Informe os itens da venda." })
  .min(1, "A venda deve ter pelo menos um item.")
  .max(MAX_SALE_ITEMS, `A venda pode ter no máximo ${MAX_SALE_ITEMS} itens.`)
  .superRefine((items, ctx) => {
    const ids = new Set<string>();
    items.forEach((item, index) => {
      if (ids.has(item.productVariantId)) {
        ctx.addIssue({ code: "custom", message: "Variante duplicada.", path: [index, "productVariantId"] });
      }
      ids.add(item.productVariantId);
    });
  });

export const PAYMENT_CONDITIONS = ["CASH", "PIX", "DEBIT_CARD", "CREDIT_CARD", "CREDIARIO"] as const;
export type PaymentConditionInput = (typeof PAYMENT_CONDITIONS)[number];

const dueDaySchema = z
  .number({ error: "Dia de vencimento inválido." })
  .int("Dia de vencimento inválido.")
  .min(1, "O dia de vencimento deve ser de 1 a 28.")
  .max(28, "O dia de vencimento deve ser de 1 a 28.");

const downPaymentSchema = z
  .number({ error: "Informe a entrada." })
  .min(0, "A entrada não pode ser negativa.")
  .max(MAX_AMOUNT, "A entrada excede o máximo permitido.")
  .refine(hasAtMostTwoDecimals, "O valor deve ter no máximo 2 casas decimais.");

/** Crediário: plano escolhido (regras, limite e gravação em CrediarioCheckoutService). */
const crediarioSchema = z.object(
  {
    installments: z
      .number({ error: "Informe o número de parcelas." })
      .int("O número de parcelas deve ser inteiro.")
      .min(1, "O número de parcelas deve ser no mínimo 1.")
      .max(24, "O número de parcelas deve ser no máximo 24."),
    downPayment: downPaymentSchema,
    downPaymentMethod: z
      .enum(["CASH", "PIX", "DEBIT_CARD", "CREDIT_CARD"], { error: "Forma de pagamento da entrada inválida." })
      .optional(),
    dueDay: dueDaySchema.optional(),
  },
  { error: "Informe o plano do crediário." },
).superRefine((plan, ctx) => {
  if (plan.downPayment > 0 && !plan.downPaymentMethod) {
    ctx.addIssue({ code: "custom", message: "Informe a forma de pagamento da entrada.", path: ["downPaymentMethod"] });
  }
});

/** Autorização de exceção (limite/atraso) por um aprovador de crédito, com a própria senha. */
const overrideSchema = z.object(
  {
    approverEmail: z.string({ error: "Informe o e-mail do aprovador." }).trim().email("E-mail inválido.").max(254),
    approverPassword: z.string({ error: "Informe a senha do aprovador." }).min(1, "Informe a senha do aprovador.").max(200),
    reason: z
      .string({ error: "Informe o motivo." })
      .trim()
      .min(3, "O motivo deve ter ao menos 3 caracteres.")
      .max(200, "O motivo deve ter no máximo 200 caracteres."),
  },
  { error: "Autorização inválida." },
);

const paymentSchema = z
  .object(
    {
      condition: z.enum(PAYMENT_CONDITIONS, { error: "Condição de pagamento inválida." }),
      cardInstallments: z
        .number({ error: "Informe o número de parcelas do cartão." })
        .int("O número de parcelas deve ser inteiro.")
        .min(1, "O número de parcelas do cartão deve ser de 1 a 12.")
        .max(12, "O número de parcelas do cartão deve ser de 1 a 12.")
        .optional(),
      passCardFee: z.boolean({ error: "Informe se a taxa do cartão é repassada." }).optional(),
      crediario: crediarioSchema.optional(),
      override: overrideSchema.optional(),
    },
    { error: "Informe a condição de pagamento." },
  )
  .superRefine((payment, ctx) => {
    if (payment.condition === "CREDIT_CARD" && payment.cardInstallments === undefined) {
      ctx.addIssue({ code: "custom", message: "Informe o número de parcelas do cartão.", path: ["cardInstallments"] });
    }
    if (payment.condition !== "CREDIT_CARD" && payment.cardInstallments !== undefined) {
      ctx.addIssue({ code: "custom", message: "Parcelas só no cartão de crédito.", path: ["cardInstallments"] });
    }
    if (payment.condition === "CREDIARIO" && !payment.crediario) {
      ctx.addIssue({ code: "custom", message: "Informe o plano do crediário.", path: ["crediario"] });
    }
    if (payment.condition !== "CREDIARIO" && payment.crediario) {
      ctx.addIssue({ code: "custom", message: "Plano do crediário só na condição crediário.", path: ["crediario"] });
    }
    if (payment.condition !== "CREDIARIO" && payment.override) {
      ctx.addIssue({ code: "custom", message: "Autorização só na condição crediário.", path: ["override"] });
    }
  });

export type SalePaymentBody = z.output<typeof paymentSchema>;

export const createSaleSchema = z.object({
  customerId: z.string({ error: "Informe o cliente." }).uuid("Cliente inválido."),
  items: saleItemsSchema,
  payment: paymentSchema,
});

export type CreateSaleBody = z.output<typeof createSaleSchema>;

/** Simulação das condições (não grava nada). */
export const simulateSaleSchema = z.object({
  customerId: z.string({ error: "Informe o cliente." }).uuid("Cliente inválido."),
  items: saleItemsSchema,
  /** Entrada do crediário (reais); ausente/menor = mínima do perfil. */
  downPayment: downPaymentSchema.optional(),
  dueDay: dueDaySchema.optional(),
});

export type SimulateSaleBody = z.output<typeof simulateSaleSchema>;
