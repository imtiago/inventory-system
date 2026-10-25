import { z } from "zod";
import { MAX_AMOUNT } from "@shared/domain/limits";
import { PaymentMethod } from "@finance/domain/enums/PaymentMethod";
import { FinancialType } from "@finance/domain/enums/FinancialType";
import { FINANCIAL_TYPE_LABEL } from "@finance/domain/enums/financialTypeLabels";
import { dateOnly } from "./financialDocumentQuerySchemas";

/** No máximo 2 casas decimais (robusto a erro de float, ex.: 0.1 + 0.2). */
const hasAtMostTwoDecimals = (v: number) => Number.isInteger(Number((v * 100).toPrecision(15)));

export const registerPaymentParamsSchema = (type: FinancialType) =>
  z.object({
    id: z.string().uuid(`${FINANCIAL_TYPE_LABEL[type]} inválida.`),
    parcelId: z.string().uuid("Parcela inválida."),
  });

export const registerPaymentBodySchema = z.object({
  amount: z
    .number({ message: "Informe o valor do pagamento." })
    .positive("O valor do pagamento deve ser maior que zero.")
    .max(MAX_AMOUNT, "O valor do pagamento excede o máximo permitido.")
    .refine(hasAtMostTwoDecimals, "O valor deve ter no máximo 2 casas decimais."),
  method: z.enum(PaymentMethod, { message: "Forma de pagamento inválida." }),
  paymentDate: dateOnly("Data do pagamento").optional(),
  reference: z
    .string({ message: "Referência inválida." })
    .trim()
    .max(100, "A referência deve ter no máximo 100 caracteres.")
    .optional()
    .nullable(),
});

export const reversePaymentParamsSchema = z.object({
  paymentId: z.string().uuid("Pagamento inválido."),
});

export const reversePaymentBodySchema = z.object({
  reason: z
    .string({ message: "Informe o motivo do estorno." })
    .trim()
    .min(3, "O motivo deve ter entre 3 e 200 caracteres.")
    .max(200, "O motivo deve ter entre 3 e 200 caracteres."),
});
