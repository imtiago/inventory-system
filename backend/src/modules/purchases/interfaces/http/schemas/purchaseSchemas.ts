import { z } from "zod";
import { todayInBusinessTz } from "@shared/domain/businessDate";
import { toCents } from "@shared/domain/money";
import { dateOnlySchema } from "@shared/interfaces/http/schemas/dateOnlySchema";
import { paginationSchema } from "@shared/interfaces/http/schemas/paginationSchema";
import { PurchaseStatus } from "@purchases/domain/enums/PurchaseStatus";

/** Limite das colunas DECIMAL(12,2), em centavos. */
const MAX_AMOUNT_CENTS = 999_999_999_999;
const MAX_QUANTITY = 1_000_000;
const MAX_UNIT_VALUE = 1_000_000;

const hasAtMostTwoDecimals = (v: number) => Number.isInteger(Number((v * 100).toPrecision(15)));

/** Valor ≥ 0 com no máximo 2 casas. */
const moneySchema = (label: string) =>
  z
    .number({ error: `${label} deve ser um número.` })
    .min(0, `${label} não pode ser negativo.`)
    .max(MAX_UNIT_VALUE, `${label} excede o máximo permitido.`)
    .refine(hasAtMostTwoDecimals, `${label} deve ter no máximo 2 casas decimais.`);

const itemSchema = z.object({
  productVariantId: z.string({ error: "Informe a variante." }).uuid("Variante inválida."),
  quantity: z
    .number({ error: "A quantidade deve ser um número." })
    .int("A quantidade deve ser um número inteiro.")
    .min(1, "A quantidade deve ser maior que zero.")
    .max(MAX_QUANTITY, "Quantidade excede o máximo permitido."),
  unitPrice: moneySchema("O preço unitário"),
  discount: moneySchema("O desconto").optional(),
  freight: moneySchema("O frete").optional(),
  tax: moneySchema("O imposto").optional(),
});

const notesSchema = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? null : v),
  z.string().trim().max(500, "As observações devem ter no máximo 500 caracteres.").nullable().optional(),
);

export const createPurchaseBodySchema = z
  .object({
    supplierId: z.string({ error: "Informe o fornecedor." }).uuid("Fornecedor inválido."),
    purchaseDate: dateOnlySchema.optional(),
    notes: notesSchema,
    items: z
      .array(itemSchema, { error: "Informe os itens do pedido." })
      .min(1, "O pedido deve ter pelo menos um item.")
      .max(200, "O pedido pode ter no máximo 200 itens."),
    paymentTerms: z.object(
      {
        installments: z
          .number({ error: "Informe o número de parcelas." })
          .int("O número de parcelas deve ser inteiro.")
          .min(1, "O número de parcelas deve ser no mínimo 1.")
          .max(12, "O número de parcelas deve ser no máximo 12."),
        firstDueDate: dateOnlySchema.optional(),
      },
      { error: "Informe a condição de pagamento." },
    ),
  })
  .superRefine((data, ctx) => {
    const ids = new Set<string>();
    let totalCents = 0;
    data.items.forEach((item, index) => {
      if (ids.has(item.productVariantId)) {
        ctx.addIssue({ code: "custom", message: "Variante duplicada.", path: ["items", index, "productVariantId"] });
      }
      ids.add(item.productVariantId);
      totalCents += Math.abs(
        item.quantity * toCents(item.unitPrice) -
          toCents(item.discount ?? 0) +
          toCents(item.freight ?? 0) +
          toCents(item.tax ?? 0),
      );
    });
    if (totalCents > MAX_AMOUNT_CENTS) {
      ctx.addIssue({ code: "custom", message: "O total do pedido excede o máximo permitido.", path: ["items"] });
    }

    // "YYYY-MM-DD": comparação lexicográfica = cronológica.
    const today = todayInBusinessTz();
    if (data.purchaseDate && data.purchaseDate > today) {
      ctx.addIssue({ code: "custom", message: "A data do pedido não pode ser futura.", path: ["purchaseDate"] });
    }
    const { installments, firstDueDate } = data.paymentTerms;
    if (installments > 1 && !firstDueDate) {
      ctx.addIssue({ code: "custom", message: "Informe o primeiro vencimento.", path: ["paymentTerms", "firstDueDate"] });
    }
    if (firstDueDate && firstDueDate < (data.purchaseDate ?? today)) {
      ctx.addIssue({
        code: "custom",
        message: "O primeiro vencimento não pode ser anterior à data do pedido.",
        path: ["paymentTerms", "firstDueDate"],
      });
    }
  })
  .transform((data) => ({
    supplierId: data.supplierId,
    purchaseDate: data.purchaseDate,
    notes: data.notes ?? null,
    items: data.items.map((item) => ({
      productVariantId: item.productVariantId,
      quantity: item.quantity,
      unitPriceCents: toCents(item.unitPrice),
      discountCents: toCents(item.discount ?? 0),
      freightCents: toCents(item.freight ?? 0),
      taxCents: toCents(item.tax ?? 0),
    })),
    paymentTerms: data.paymentTerms,
  }));

export const cancelPurchaseBodySchema = z.object(
  {
    reason: z
      .string({ error: "Informe o motivo do cancelamento." })
      .trim()
      .min(3, "O motivo deve ter no mínimo 3 caracteres.")
      .max(200, "O motivo deve ter no máximo 200 caracteres."),
  },
  { error: "Informe o motivo do cancelamento." },
);

export const purchaseIdParamsSchema = z.object({
  id: z.string().uuid("Pedido inválido."),
});

const blankToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

export const listPurchasesSchema = paginationSchema
  .extend({
    status: z.preprocess(blankToUndefined, z.enum(PurchaseStatus, { error: "Status inválido." }).optional()),
    supplierId: z.preprocess(blankToUndefined, z.string().uuid("Fornecedor inválido.").optional()),
    from: z.preprocess(blankToUndefined, dateOnlySchema.optional()),
    to: z.preprocess(blankToUndefined, dateOnlySchema.optional()),
    search: z.preprocess(blankToUndefined, z.string().trim().max(60, "Busca muito longa.").optional()),
  })
  .refine((q) => !q.from || !q.to || q.from <= q.to, {
    message: "A data inicial não pode ser posterior à final.",
    path: ["from"],
  });
