import { z } from "zod";
import { MAX_AMOUNT } from "@shared/domain/limits";
import { dateOnlySchema } from "@shared/interfaces/http/schemas/dateOnlySchema";
import { paginationSchema } from "@shared/interfaces/http/schemas/paginationSchema";
import { CreditProfileCode } from "@credit/domain/CreditProfileCode";

const hasAtMostTwoDecimals = (v: number) => Number.isInteger(Number((v * 100).toPrecision(15)));

const money = (label: string) =>
  z
    .number({ error: `Informe ${label}.` })
    .finite(`Informe ${label}.`)
    .min(0, `${label[0].toUpperCase()}${label.slice(1)} não pode ser negativo.`)
    .max(MAX_AMOUNT, `${label[0].toUpperCase()}${label.slice(1)} excede o máximo permitido.`)
    .refine(hasAtMostTwoDecimals, `${label[0].toUpperCase()}${label.slice(1)} deve ter no máximo 2 casas decimais.`);

const text = (label: string, max: number) =>
  z.string({ error: `${label} inválido.` }).trim().max(max, `${label} deve ter no máximo ${max} caracteres.`);

const dueDatesSchema = z
  .array(z.object({ date: dateOnlySchema, amount: money("o valor do vencimento") }))
  .max(48, "Informe no máximo 48 vencimentos.");

const idParam = z.string().uuid("Identificador inválido.");

export const legacyBatchParamsSchema = z.object({ id: idParam });
export const legacyRowParamsSchema = z.object({ id: idParam, rowId: idParam });
export const listLegacyBatchesSchema = paginationSchema;

export const createLegacyBatchSchema = z.object({ source: z.literal("MANUAL", { error: "Origem inválida." }) });

export const addLegacyRowsSchema = z.object({
  customer: z.union([
    z.object({ existingId: idParam }),
    z.object({
      name: text("Nome", 120).min(1, "Informe o nome do cliente."),
      phone: text("Celular", 40).nullish(),
    }),
  ]),
  debts: z
    .array(
      z.object({
        amount: money("o valor"),
        paid: money("o valor pago").optional(),
        purchaseDate: dateOnlySchema.optional(),
        description: text("Descrição", 200).optional(),
        notes: text("Observação", 500).optional(),
        dueDates: dueDatesSchema.optional(),
      }),
    )
    .min(1, "Informe ao menos uma dívida.")
    .max(200, "Informe no máximo 200 dívidas por lançamento."),
});

export const updateLegacyRowSchema = z
  .object({
    data: z
      .object({
        name: text("Nome", 120),
        phone: text("Celular", 40).nullable(),
        purchaseDate: dateOnlySchema.nullable(),
        description: text("Descrição", 200).nullable(),
        total: money("o valor total"),
        paid: money("o valor pago"),
        dueDates: dueDatesSchema.nullable(),
        profileCode: z.enum(CreditProfileCode, { error: "Perfil de crédito inválido." }).nullable(),
        notes: text("Observação", 500).nullable(),
      })
      .partial()
      .optional(),
    customerAction: z
      .discriminatedUnion("kind", [
        z.object({ kind: z.literal("NEW") }),
        z.object({ kind: z.literal("LINK"), customerId: idParam }),
        z.object({ kind: z.literal("SAME_AS_ROW"), rowId: idParam }),
      ])
      .optional(),
    ignored: z.boolean({ error: "Valor inválido." }).optional(),
    acceptDuplicate: z.boolean({ error: "Valor inválido." }).optional(),
  })
  .refine((v) => v.data !== undefined || v.customerAction !== undefined || v.ignored !== undefined || v.acceptDuplicate !== undefined, {
    message: "Informe o que alterar.",
  });

export const confirmLegacyBatchSchema = z
  .object({
    limitRule: z
      .enum(["MAX_OF_PROFILE_AND_BALANCE", "PROFILE_ONLY"], { error: "Regra de limite inválida." })
      .optional(),
  })
  .optional()
  .transform((v) => v ?? {});
