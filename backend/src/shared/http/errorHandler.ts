import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import {
  BusinessRuleError,
  ConflictError,
  DomainError,
  ForbiddenError,
  NotFoundError,
  TooManyRequestsError,
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
  if (error instanceof TooManyRequestsError) return 429;
  return 500;
}

// Deadlock (40P01) e lock timeout (55P03) vindos do Postgres, ou conflito de
// transação do Prisma (P2034).
const CONCURRENCY_PG_CODES = new Set(["40P01", "55P03"]);

// Erros do Postgres embutidos na mensagem de PrismaClientUnknownRequestError
// (queries Prisma comuns, não-raw), ex.: `PostgresError { code: "55P03", ...`.
const PG_CODE_IN_MESSAGE = /PostgresError \{ code: "(40P01|55P03)"/;

function isConcurrentUpdateError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientUnknownRequestError) {
    return PG_CODE_IN_MESSAGE.test(error.message);
  }
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code === "P2034") return true;
  const meta = error.meta as Record<string, unknown> | undefined;
  if (
    (error.code === "P2010" || error.code === "P2028") &&
    typeof meta?.code === "string" &&
    CONCURRENCY_PG_CODES.has(meta.code)
  ) {
    return true;
  }
  // P2028 por expiração do timeout da transação interativa (ex.: espera longa
  // por travas). Outros P2028 (maxWait, transação inexistente) não são mapeados.
  return (
    error.code === "P2028" &&
    typeof meta?.error === "string" &&
    /expired transaction/.test(meta.error)
  );
}

// Rede de segurança: FK violada (P2003; ou 23503 do Postgres em query raw, P2010).
function isForeignKeyViolation(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code === "P2003") return true;
  const meta = error.meta as Record<string, unknown> | undefined;
  return error.code === "P2010" && meta?.code === "23503";
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

  if (isConcurrentUpdateError(error)) {
    return reply.status(409).send({
      message: "Operação em andamento para este item. Tente novamente.",
      code: "CONCURRENT_UPDATE",
    });
  }

  if (isForeignKeyViolation(error)) {
    return reply
      .status(409)
      .send({ message: "Registro em uso por outros dados.", code: "RESOURCE_IN_USE" });
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
