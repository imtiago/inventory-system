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
    const payload = jwt.verify(token, env.JWT_SECRET);
    if (
      typeof payload !== "object" ||
      payload === null ||
      typeof payload.sub !== "string"
    ) {
      throw new UnauthorizedError("Token inválido.");
    }
    request.user = payload as { sub: string; role: string };
  } catch {
    throw new UnauthorizedError("Token inválido.");
  }
}
