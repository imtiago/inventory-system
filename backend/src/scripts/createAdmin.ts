// src/scripts/createAdmin.ts
// Cria (ou promove) o administrador inicial. Uso:
//   ADMIN_NAME="..." ADMIN_EMAIL="..." ADMIN_PASSWORD="..." npm run create-admin
import "dotenv/config";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import { prisma } from "@shared/prisma";
import { User } from "@auth/domain/entities/User";
import { UserRole } from "@auth/domain/enums/UserRole";
import { PrismaUserRepository } from "@auth/infrastructure/prisma/repositories/PrismaUserRepository";
import { BcryptPasswordHasher } from "@auth/infrastructure/security/BcryptPasswordHasher";
import { passwordSchema } from "@auth/interfaces/http/schemas/createUserSchema";

const createAdminSchema = z.object({
  name: z.string({ error: "ADMIN_NAME é obrigatório." }).trim().min(1, "ADMIN_NAME é obrigatório."),
  email: z
    .string({ error: "ADMIN_EMAIL é obrigatório." })
    .trim()
    .toLowerCase()
    .email("ADMIN_EMAIL inválido."),
  password: passwordSchema,
});

export type CreateAdminInput = { name?: string; email?: string; password?: string };
export type CreateAdminResult = { id: string; email: string; created: boolean };

/**
 * Idempotente: se já existe usuário com o e-mail, promove a ADMIN, reativa e
 * redefine a senha (o nome é mantido); senão cria um novo ADMIN.
 */
export async function createAdmin(input: CreateAdminInput): Promise<CreateAdminResult> {
  const parsed = createAdminSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => i.message).join(" "));
  }
  const { name, email, password } = parsed.data;

  const users = new PrismaUserRepository();
  const hasher = new BcryptPasswordHasher();
  const passwordHash = await hasher.hash(password);

  const existing = await users.findByEmail(email);
  if (existing) {
    existing.changeRole(UserRole.ADMIN);
    existing.activate();
    existing.changePassword(passwordHash);
    await users.update(existing);
    return { id: existing.id, email, created: false };
  }

  const user = new User({ name, email, password: passwordHash, role: UserRole.ADMIN, active: true });
  await users.create(user);
  return { id: user.id, email, created: true };
}

async function main(): Promise<void> {
  try {
    const result = await createAdmin({
      name: process.env.ADMIN_NAME,
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
    });
    console.log(
      result.created
        ? `Administrador criado: ${result.email}`
        : `Usuário existente promovido a administrador (senha redefinida): ${result.email}`,
    );
  } catch (error) {
    console.error(`Falha ao criar administrador: ${(error as Error).message}`);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main();
}
