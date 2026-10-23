import type { FastifyReply, FastifyRequest } from "fastify";
import {
  BusinessRuleError,
  ConflictError,
  ErrorCodes,
  InternalErrorCodes,
  InternalInvariantError,
  UnauthorizedError,
  ValidationError,
} from "@shared/domain/errors";
import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";
import { IdempotencyScope, PrismaIdempotencyStore } from "./PrismaIdempotencyStore";
import { requestHash } from "./requestHash";

export const IDEMPOTENCY_KEY_HEADER = "idempotency-key";
export const IDEMPOTENT_REPLAYED_HEADER = "Idempotent-Replayed";

/** 8–100 caracteres [A-Za-z0-9_-] (o front usa UUID v4). */
const KEY_PATTERN = /^[A-Za-z0-9_-]{8,100}$/;

/** A cada N chaves novas (por processo), remove um lote de registros vencidos. */
const PURGE_EVERY = 100;
const PURGE_BATCH = 1000;
let claimsSincePurge = 0;

export interface IdempotentOptions {
  /**
   * Tempos da transação externa. Os casos de uso aninhados entram nela e as
   * opções deles são ignoradas, então a rota deve passar aqui os tempos da
   * operação mais longa que cobre (ex.: confirmação de NF-e).
   */
  timeout?: number;
  maxWait?: number;
  lockTimeoutMs?: number;
}

type RouteHandler = (request: FastifyRequest, reply: FastifyReply) => unknown;

interface CapturedResponse {
  statusCode: number;
  body: unknown;
}

function readKey(request: FastifyRequest): string {
  const raw = request.headers[IDEMPOTENCY_KEY_HEADER];
  if (raw === undefined || raw === "") {
    throw new ValidationError(
      "Cabeçalho Idempotency-Key é obrigatório.",
      [{ field: "Idempotency-Key", message: "Cabeçalho Idempotency-Key é obrigatório." }],
      ErrorCodes.IDEMPOTENCY_KEY_REQUIRED,
    );
  }
  if (typeof raw !== "string" || !KEY_PATTERN.test(raw)) {
    throw new ValidationError("Dados inválidos.", [
      {
        field: "Idempotency-Key",
        message: "A chave deve ter de 8 a 100 caracteres (letras, números, _ ou -).",
      },
    ]);
  }
  return raw;
}

/** Corpo JSON como será enviado (Date → string etc.); só objetos, arrays ou vazio. */
function toJsonBody(payload: unknown): unknown {
  if (payload === undefined || payload === null) return undefined;
  if (typeof payload !== "object" || Buffer.isBuffer(payload) || typeof (payload as { pipe?: unknown }).pipe === "function") {
    throw new InternalInvariantError(
      "Rota idempotente só pode responder JSON.",
      InternalErrorCodes.IDEMPOTENT_RESPONSE_INVALID,
    );
  }
  return JSON.parse(JSON.stringify(payload));
}

/**
 * Executa o controller com um `reply` que só registra status e corpo: nada vai
 * para o cliente antes do commit. Outras chamadas (header, log...) seguem para
 * o reply real; as encadeáveis devolvem o proxy, para `reply.header().send()`
 * também ser capturado.
 */
async function runCapturing(
  handler: RouteHandler,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<CapturedResponse> {
  let statusCode: number | undefined;
  let sent = false;
  let payload: unknown;

  const proxy: FastifyReply = new Proxy(reply, {
    get(target, prop) {
      if (prop === "status" || prop === "code") {
        return (code: number) => {
          statusCode = code;
          return proxy;
        };
      }
      if (prop === "send") {
        return (body?: unknown) => {
          if (sent) {
            throw new InternalInvariantError(
              "Resposta enviada duas vezes.",
              InternalErrorCodes.IDEMPOTENT_RESPONSE_INVALID,
            );
          }
          sent = true;
          payload = body;
          return proxy;
        };
      }
      if (prop === "statusCode") return statusCode ?? target.statusCode;
      if (prop === "sent") return sent;
      // O FastifyReply é "thenable" (espera o envio real); o controller devolve o
      // proxy e o `await` abaixo não pode esperar um envio que só ocorre após o commit.
      if (prop === "then") return undefined;
      const value = Reflect.get(target, prop, target);
      if (typeof value !== "function") return value;
      return (...args: unknown[]) => {
        const result = (value as (...a: unknown[]) => unknown).apply(target, args);
        return result === target ? proxy : result;
      };
    },
  });

  const returned = await handler(request, proxy);
  if (!sent && returned !== undefined && returned !== proxy) payload = returned;
  return { statusCode: statusCode ?? reply.statusCode, body: toJsonBody(payload) };
}

/**
 * Torna um handler POST idempotente pelo cabeçalho `Idempotency-Key`:
 * - sem cabeçalho → 400 IDEMPOTENCY_KEY_REQUIRED; formato inválido → 400 VALIDATION_ERROR;
 * - na mesma transação da operação: INSERT ... ON CONFLICT DO NOTHING do registro;
 *   se já existia, lê com FOR UPDATE → mesmo hash: devolve a resposta gravada com
 *   `Idempotent-Replayed: true`; hash diferente: 422 IDEMPOTENCY_KEY_REUSED;
 * - senão executa o controller, grava status + corpo e confirma junto. A resposta
 *   só é enviada depois do commit. Qualquer erro desfaz tudo, inclusive o registro.
 */
export function idempotent(handler: RouteHandler, options: IdempotentOptions = {}) {
  const store = new PrismaIdempotencyStore();
  const transactions = new PrismaTransactionManager(options);

  return async function idempotentHandler(request: FastifyRequest, reply: FastifyReply) {
    const key = readKey(request);
    const userId = request.user?.sub;
    if (!userId) throw new UnauthorizedError("Token ausente.");
    if (request.isMultipart?.()) {
      throw new InternalInvariantError(
        "Rota idempotente não aceita multipart.",
        InternalErrorCodes.IDEMPOTENT_RESPONSE_INVALID,
      );
    }

    const route = request.routeOptions.url ?? request.url;
    const scope: IdempotencyScope = { userId, method: request.method, route, key };
    const hash = requestHash({ method: request.method, route, params: request.params, body: request.body });

    const outcome = await transactions.execute(async () => {
      const recordId = await store.claim(scope, hash);

      if (recordId === null) {
        const existing = await store.lockExisting(scope);
        if (!existing || existing.statusCode === null) {
          // Registro removido entre o INSERT e o SELECT (purge) ou ainda sem resposta.
          throw new ConflictError(
            "Operação em andamento para este item. Tente novamente.",
            ErrorCodes.CONCURRENT_UPDATE,
          );
        }
        if (existing.requestHash !== hash) {
          throw new BusinessRuleError(
            "Esta chave já foi usada em outra operação.",
            ErrorCodes.IDEMPOTENCY_KEY_REUSED,
          );
        }
        return {
          replayed: true,
          statusCode: existing.statusCode,
          body: existing.responseBody ?? undefined,
        };
      }

      if (++claimsSincePurge >= PURGE_EVERY) {
        claimsSincePurge = 0;
        await store.purgeExpired(PURGE_BATCH);
      }

      const response = await runCapturing(handler, request, reply);
      await store.saveResponse(recordId, response.statusCode, response.body);
      return { replayed: false, ...response };
    });

    // Commit feito: só agora a resposta vai para o cliente.
    if (outcome.replayed) reply.header(IDEMPOTENT_REPLAYED_HEADER, "true");
    reply.status(outcome.statusCode);
    return outcome.body === undefined ? reply.send() : reply.send(outcome.body);
  };
}
