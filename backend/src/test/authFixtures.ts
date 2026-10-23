import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { prisma } from "@shared/prisma";
import { JWT_AUDIENCE, JWT_ISSUER } from "@auth/infrastructure/security/JwtTokenService";

type Role = "ADMIN" | "VENDEDOR" | "ESTOQUISTA";

/**
 * Assina um token como o JwtTokenService (HS256, issuer/audience da API).
 * O papel efetivo vem do banco; a claim `role` é só informativa.
 */
export function signTestToken(
  sub: string,
  role: string = "ADMIN",
  options: jwt.SignOptions = {},
): string {
  return jwt.sign({ sub, role }, process.env.JWT_SECRET!, {
    expiresIn: "1h",
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
    ...options,
  });
}

export type TestUser = {
  id: string;
  name: string;
  email: string;
  password: string;
  role: Role;
  cleanup(): Promise<void>;
};

/**
 * Cria um usuário `tx-test-<uuid>@example.com` exclusivo do teste.
 * cleanup() apaga por id; se FKs impedirem, deixa o usuário inativo.
 */
export async function createTestUser(
  opts: { role?: Role; active?: boolean; password?: string } = {},
): Promise<TestUser> {
  const email = `tx-test-${randomUUID()}@example.com`;
  const password = opts.password ?? "senha-de-teste";
  const role = opts.role ?? "VENDEDOR";
  const user = await prisma.user.create({
    data: {
      name: "tx-test-user",
      email,
      password: await bcrypt.hash(password, 4),
      role,
      active: opts.active ?? true,
    },
  });
  return {
    id: user.id,
    name: user.name,
    email,
    password,
    role,
    async cleanup() {
      try {
        await prisma.user.deleteMany({ where: { id: user.id } });
      } catch {
        await prisma.user.updateMany({ where: { id: user.id }, data: { active: false } });
      }
    },
  };
}
