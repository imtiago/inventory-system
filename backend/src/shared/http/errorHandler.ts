import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import {
  BusinessRuleError,
  ConflictError,
  DomainError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "../domain/errors";

function domainStatus(error: DomainError): number {
  if (error instanceof ValidationError) return 400;
  if (error instanceof UnauthorizedError) return 401;
  if (error instanceof ForbiddenError) return 403;
  if (error instanceof NotFoundError) return 404;
  if (error instanceof ConflictError) return 409;
  if (error instanceof BusinessRuleError) return 422;
  return 500;
}

export function errorHandler(
  error: unknown,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  if (error instanceof ValidationError) {
    return reply.status(400).send({
      message: error.message,
      code: error.code,
      errors: error.errors,
    });
  }

  if (error instanceof ZodError) {
    return reply.status(400).send({
      message: "Dados inválidos.",
      code: "VALIDATION_ERROR",
      errors: error.issues.map((i) => ({
        field: i.path.join("."),
        message: i.message,
      })),
    });
  }

  if (error instanceof DomainError) {
    const status = domainStatus(error);
    if (status < 500) {
      return reply.status(status).send({ message: error.message, code: error.code });
    }
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return reply.status(409).send({ message: "Registro já existe.", code: "CONFLICT" });
    }
    if (error.code === "P2025") {
      return reply
        .status(404)
        .send({ message: "Registro não encontrado.", code: "NOT_FOUND" });
    }
  }

  const statusCode = (error as FastifyError | undefined)?.statusCode;
  if (
    typeof error === "object" &&
    error !== null &&
    typeof statusCode === "number" &&
    statusCode >= 400 &&
    statusCode < 500
  ) {
    return reply
      .status(statusCode)
      .send({ message: "Requisição inválida.", code: "BAD_REQUEST" });
  }

  request.log.error(error);
  return reply
    .status(500)
    .send({ message: "Erro interno do servidor.", code: "INTERNAL_ERROR" });
}

export function registerErrorHandling(app: FastifyInstance): void {
  app.setErrorHandler(errorHandler);
  app.setNotFoundHandler((_request, reply) => {
    return reply
      .status(404)
      .send({ message: "Rota não encontrada.", code: "ROUTE_NOT_FOUND" });
  });
}
