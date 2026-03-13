// src/shared/middleware/auth.ts
import { FastifyReply, FastifyRequest } from "fastify";
import jwt from "jsonwebtoken";

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      return reply.status(401).send({ message: "Token ausente" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret") as {
      sub: string;
      role: string;
    };

    request.user = decoded; // ✅ agora TypeScript sabe que request.user existe
  } catch (err) {
    return reply.status(401).send({ message: "Token inválido" });
  }
}
