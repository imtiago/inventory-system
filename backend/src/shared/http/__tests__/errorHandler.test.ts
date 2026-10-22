import { test } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { registerErrorHandling } from "../errorHandler";
import {
  BusinessRuleError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "../../domain/errors";

function build(thrower: () => unknown) {
  const app = Fastify();
  registerErrorHandling(app);
  app.get("/boom", async () => {
    throw thrower();
  });
  app.post("/json", async () => ({ ok: true }));
  return app;
}

async function call(thrower: () => unknown) {
  const app = build(thrower);
  const res = await app.inject({ method: "GET", url: "/boom" });
  await app.close();
  return { status: res.statusCode, body: res.json() };
}

test("NotFoundError → 404 {message, code}", async () => {
  const r = await call(() => new NotFoundError("Produto não encontrado.", "PRODUCT_NOT_FOUND"));
  assert.equal(r.status, 404);
  assert.deepEqual(r.body, { message: "Produto não encontrado.", code: "PRODUCT_NOT_FOUND" });
});

test("ConflictError → 409", async () => {
  const r = await call(() => new ConflictError("Já existe."));
  assert.equal(r.status, 409);
  assert.deepEqual(r.body, { message: "Já existe.", code: "CONFLICT" });
});

test("BusinessRuleError → 422", async () => {
  const r = await call(() => new BusinessRuleError("Estoque insuficiente."));
  assert.equal(r.status, 422);
  assert.deepEqual(r.body, { message: "Estoque insuficiente.", code: "BUSINESS_RULE" });
});

test("UnauthorizedError → 401", async () => {
  const r = await call(() => new UnauthorizedError("Token ausente."));
  assert.equal(r.status, 401);
  assert.deepEqual(r.body, { message: "Token ausente.", code: "UNAUTHENTICATED" });
});

test("ForbiddenError → 403", async () => {
  const r = await call(() => new ForbiddenError());
  assert.equal(r.status, 403);
  assert.deepEqual(r.body, { message: "Acesso negado.", code: "FORBIDDEN" });
});

test("ValidationError → 400 com errors", async () => {
  const errors = [{ field: "quantity", message: "Quantidade inválida." }];
  const r = await call(() => new ValidationError("Dados inválidos.", errors));
  assert.equal(r.status, 400);
  assert.deepEqual(r.body, { message: "Dados inválidos.", code: "VALIDATION_ERROR", errors });
});

test("ZodError não capturado → 400 VALIDATION_ERROR", async () => {
  const r = await call(() => {
    const res = z.object({ a: z.string() }).safeParse({});
    return res.success ? null : res.error;
  });
  assert.equal(r.status, 400);
  assert.equal(r.body.code, "VALIDATION_ERROR");
  assert.equal(r.body.message, "Dados inválidos.");
  assert.equal(r.body.errors[0].field, "a");
});

test("Prisma P2002 → 409 CONFLICT 'Registro já existe.'", async () => {
  const r = await call(
    () => new Prisma.PrismaClientKnownRequestError("x", { code: "P2002", clientVersion: "6" }),
  );
  assert.equal(r.status, 409);
  assert.deepEqual(r.body, { message: "Registro já existe.", code: "CONFLICT" });
});

test("Prisma P2025 → 404 NOT_FOUND", async () => {
  const r = await call(
    () => new Prisma.PrismaClientKnownRequestError("x", { code: "P2025", clientVersion: "6" }),
  );
  assert.equal(r.status, 404);
  assert.deepEqual(r.body, { message: "Registro não encontrado.", code: "NOT_FOUND" });
});

test("JSON malformado → 400 BAD_REQUEST", async () => {
  const app = build(() => null);
  const res = await app.inject({
    method: "POST",
    url: "/json",
    headers: { "content-type": "application/json" },
    payload: "{oops",
  });
  await app.close();
  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.json(), { message: "Requisição inválida.", code: "BAD_REQUEST" });
});

test("erro desconhecido → 500 sem a mensagem original", async () => {
  const r = await call(() => new Error("segredo do banco"));
  assert.equal(r.status, 500);
  assert.deepEqual(r.body, { message: "Erro interno do servidor.", code: "INTERNAL_ERROR" });
  assert.ok(!JSON.stringify(r.body).includes("segredo"));
});

test("throw de string → 500 INTERNAL_ERROR", async () => {
  const r = await call(() => "algo deu errado");
  assert.equal(r.status, 500);
  assert.equal(r.body.code, "INTERNAL_ERROR");
});

test("rota inexistente → 404 ROUTE_NOT_FOUND", async () => {
  const app = build(() => null);
  const res = await app.inject({ method: "GET", url: "/nao-existe" });
  await app.close();
  assert.equal(res.statusCode, 404);
  assert.deepEqual(res.json(), { message: "Rota não encontrada.", code: "ROUTE_NOT_FOUND" });
});
