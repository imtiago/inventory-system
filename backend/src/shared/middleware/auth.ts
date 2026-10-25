// src/shared/middleware/auth.ts
import { FastifyRequest } from "fastify";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { UnauthorizedError } from "../domain/errors";
import {
  JWT_ALGORITHM,
  JWT_AUDIENCE,
  JWT_ISSUER,
} from "@auth/infrastructure/security/JwtTokenService";
import { SessionUserReader } from "@auth/application/ports/SessionUserReader";
import { PrismaSessionUserReader } from "@auth/infrastructure/prisma/contracts/PrismaSessionUserReader";

const BEARER_PREFIX = "Bearer ";

function extractBearerToken(header: string | undefined): string | null {
  if (!header || !header.startsWith(BEARER_PREFIX)) return null;
  const token = header.slice(BEARER_PREFIX.length).trim();
  return token.length > 0 ? token : null;
}

type VerifiedToken = { sub: string; iat: number | undefined };

function verifyToken(token: string): VerifiedToken {
  let payload: string | jwt.JwtPayload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET, {
      algorithms: [JWT_ALGORITHM],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
  } catch {
    throw new UnauthorizedError("Token inválido.");
  }
  if (typeof payload !== "object" || payload === null || typeof payload.sub !== "string") {
    throw new UnauthorizedError("Token inválido.");
  }
  return { sub: payload.sub, iat: typeof payload.iat === "number" ? payload.iat : undefined };
}

/**
 * Subject do token quando a assinatura é válida (sem consultar o banco); `null`
 * caso contrário. Serve de chave do rate limit, que roda antes de `authenticate`.
 */
export function verifiedSubject(request: FastifyRequest): string | null {
  const token = extractBearerToken(request.headers.authorization);
  if (!token) return null;
  try {
    return verifyToken(token).sub;
  } catch {
    return null;
  }
}

/**
 * Token emitido antes da última troca/redefinição de senha? Comparação em segundos
 * inteiros (o `iat` do JWT é em segundos): recusa quando iat < floor(passwordChangedAt).
 * Um token do mesmo segundo da troca é aceito (o token devolvido pela troca é assinado
 * depois de gravar passwordChangedAt, então nunca fica para trás).
 */
function issuedBeforePasswordChange(iat: number | undefined, passwordChangedAt: Date | null): boolean {
  if (!passwordChangedAt) return false;
  if (iat === undefined) return true;
  return iat < Math.floor(passwordChangedAt.getTime() / 1000);
}

export function makeAuthenticate(sessionUsers: SessionUserReader) {
  return async function authenticate(request: FastifyRequest): Promise<void> {
    const token = extractBearerToken(request.headers.authorization);
    if (!token) {
      throw new UnauthorizedError("Token ausente.");
    }

    const { sub, iat } = verifyToken(token);

    // Sessão verificada no banco a cada requisição: usuário apagado ou
    // desativado perde o acesso imediatamente; troca/redefinição de senha derruba
    // os tokens emitidos antes dela; o papel vem do banco.
    const user = await sessionUsers.findById(sub);
    if (!user || !user.active || issuedBeforePasswordChange(iat, user.passwordChangedAt)) {
      throw new UnauthorizedError("Sessão inválida.");
    }

    request.user = { sub: user.id, role: user.role };
  };
}

export const authenticate = makeAuthenticate(new PrismaSessionUserReader());
