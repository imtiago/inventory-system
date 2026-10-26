import { z } from "zod";
import { MAX_QUANTITY, MAX_SALE_ITEMS } from "@shared/domain/limits";
import { todayInBusinessTz } from "@shared/domain/businessDate";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Data sem hora "YYYY-MM-DD", interpretada como meia-noite UTC. */
const dateOnlySchema = z
  .string({ error: "Informe a data no formato AAAA-MM-DD." })
  .regex(DATE_ONLY, "Informe a data no formato AAAA-MM-DD.")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "Data inválida.");

const saleItemSchema = z.object({
  productVariantId: z.string({ error: "Informe a variante." }).uuid("Variante inválida."),
  quantity: z
    .number({ error: "A quantidade deve ser um número." })
    .int("A quantidade deve ser um número inteiro.")
    .positive("A quantidade deve ser maior que zero.")
    .max(MAX_QUANTITY, "Quantidade excede o máximo permitido."),
});

const paymentTermsSchema = z.object(
  {
    installments: z
      .number({ error: "Informe o número de parcelas." })
      .int("O número de parcelas deve ser inteiro.")
      .min(1, "O número de parcelas deve ser no mínimo 1.")
      .max(12, "O número de parcelas deve ser no máximo 12."),
    firstDueDate: dateOnlySchema.optional(),
  },
  { error: "Informe a condição de pagamento." },
);

export const createSaleSchema = z
  .object({
    customerId: z.string({ error: "Informe o cliente." }).uuid("Cliente inválido."),
    items: z
      .array(saleItemSchema, { error: "Informe os itens da venda." })
      .min(1, "A venda deve ter pelo menos um item.")
      .max(MAX_SALE_ITEMS, `A venda pode ter no máximo ${MAX_SALE_ITEMS} itens.`),
    paymentTerms: paymentTermsSchema,
  })
  .superRefine((data, ctx) => {
    const ids = new Set<string>();
    data.items.forEach((item, index) => {
      if (ids.has(item.productVariantId)) {
        ctx.addIssue({
          code: "custom",
          message: "Variante duplicada.",
          path: ["items", index, "productVariantId"],
        });
      }
      ids.add(item.productVariantId);
    });

    const { installments, firstDueDate } = data.paymentTerms;
    if (installments > 1 && !firstDueDate) {
      ctx.addIssue({
        code: "custom",
        message: "Informe o primeiro vencimento.",
        path: ["paymentTerms", "firstDueDate"],
      });
    }
    // Comparação lexicográfica de "YYYY-MM-DD" equivale à cronológica.
    if (firstDueDate && firstDueDate < todayInBusinessTz()) {
      ctx.addIssue({
        code: "custom",
        message: "O primeiro vencimento não pode ser anterior a hoje.",
        path: ["paymentTerms", "firstDueDate"],
      });
    }
  })
  .transform((data) => ({
    customerId: data.customerId,
    items: data.items,
    paymentTerms: {
      installments: data.paymentTerms.installments,
      firstDueDate: data.paymentTerms.firstDueDate
        ? new Date(`${data.paymentTerms.firstDueDate}T00:00:00.000Z`)
        : undefined,
    },
  }));

export type CreateSaleBody = z.output<typeof createSaleSchema>;
