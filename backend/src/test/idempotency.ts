import { randomUUID } from "node:crypto";

/** Chave de idempotência aleatória e válida (8–100 de [A-Za-z0-9_-]). */
export function newIdempotencyKey(): string {
  return `tx-test-${randomUUID()}`;
}

/**
 * Cabeçalhos com `Idempotency-Key` aleatório nas requisições POST (as rotas
 * cobertas exigem o cabeçalho; nas demais ele é ignorado). Cada chamada gera
 * uma chave nova: os testes existentes continuam executando cada requisição.
 */
export function withIdempotencyKey<H extends Record<string, string>>(
  method: string,
  headers: H,
): H & { "idempotency-key"?: string } {
  return method.toUpperCase() === "POST"
    ? { ...headers, "idempotency-key": newIdempotencyKey() }
    : headers;
}
