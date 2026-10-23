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

function verifyToken(token: string): string {
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
  return payload.sub;
}

export function makeAuthenticate(sessionUsers: SessionUserReader) {
  return async function authenticate(request: FastifyRequest): Promise<void> {
    const token = extractBearerToken(request.headers.authorization);
    if (!token) {
      throw new UnauthorizedError("Token ausente.");
    }

    const sub = verifyToken(token);

    // Sessão verificada no banco a cada requisição: usuário apagado ou
    // desativado perde o acesso imediatamente; o papel vem do banco.
    const user = await sessionUsers.findById(sub);
    if (!user || !user.active) {
      throw new UnauthorizedError("Sessão inválida.");
    }

    request.user = { sub: user.id, role: user.role };
  };
}

export const authenticate = makeAuthenticate(new PrismaSessionUserReader());
