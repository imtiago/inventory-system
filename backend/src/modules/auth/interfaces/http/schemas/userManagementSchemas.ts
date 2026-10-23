import { z } from "zod";
import { paginationSchema } from "@shared/interfaces/http/schemas/paginationSchema";
import { nameSchema, passwordSchema, userRoleSchema } from "./createUserSchema";

export const listUsersSchema = paginationSchema.extend({
  search: z.string().trim().optional(),
});

export const userIdParamsSchema = z.object({
  id: z.string().uuid("Identificador inválido."),
});

export const updateUserSchema = z
  .object({
    name: nameSchema.optional(),
    role: userRoleSchema.optional(),
    active: z.boolean({ error: "Informe verdadeiro ou falso." }).optional(),
  })
  .refine(
    (data) => data.name !== undefined || data.role !== undefined || data.active !== undefined,
    { message: "Informe ao menos um campo para alterar." },
  );

export const resetUserPasswordSchema = z.object({
  password: passwordSchema,
});

export const changeOwnPasswordSchema = z.object({
  currentPassword: z
    .string({ error: "A senha atual é obrigatória." })
    .min(1, "A senha atual é obrigatória.")
    .max(1024, "A senha deve ter no máximo 1024 caracteres."),
  newPassword: passwordSchema,
});
