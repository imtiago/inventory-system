// src/shared/middleware/auth.ts
import { FastifyRequest } from "fastify";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { UnauthorizedError } from "../domain/errors";

export async function authenticate(request: FastifyRequest): Promise<void> {
  const authHeader = request.headers.authorization;
  if (!authHeader) {
    throw new UnauthorizedError("Token ausente.");
  }

  const token = authHeader.split(" ")[1];
  try {
    request.user = jwt.verify(token, env.JWT_SECRET) as {
      sub: string;
      role: string;
    };
  } catch {
    throw new UnauthorizedError("Token inválido.");
  }
}
