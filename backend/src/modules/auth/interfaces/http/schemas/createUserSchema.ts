import { z } from "zod";
import { UserRole } from "@auth/domain/enums/UserRole";

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_BYTES = 72;

export const passwordSchema = z
  .string({ error: "A senha é obrigatória." })
  .min(PASSWORD_MIN_LENGTH, `A senha deve ter ao menos ${PASSWORD_MIN_LENGTH} caracteres.`)
  // O bcrypt só lê os primeiros 72 BYTES: acima disso recusamos em vez de truncar em silêncio.
  .refine((value) => Buffer.byteLength(value, "utf8") <= PASSWORD_MAX_BYTES, `A senha deve ter no máximo ${PASSWORD_MAX_BYTES} bytes.`);

export const NAME_MAX_LENGTH = 120;

export const nameSchema = z
  .string({ error: "O nome é obrigatório." })
  .trim()
  .min(1, "O nome é obrigatório.")
  .max(NAME_MAX_LENGTH, `O nome deve ter no máximo ${NAME_MAX_LENGTH} caracteres.`);

export const userRoleSchema = z.enum(UserRole, { error: "Papel inválido." });

export const createUserSchema = z.object({
  name: nameSchema,
  email: z
    .string({ error: "O e-mail é obrigatório." })
    .trim()
    .toLowerCase()
    .email("E-mail inválido."),
  password: passwordSchema,
  role: userRoleSchema,
});
