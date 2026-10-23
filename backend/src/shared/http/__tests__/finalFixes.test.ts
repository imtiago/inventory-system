import "dotenv/config";
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import { prisma } from "@shared/prisma";
import { app } from "../../../app";
import { getTestUserId } from "../../../test/inventoryFixtures";
import { signTestToken } from "../../../test/authFixtures";
import { JWT_AUDIENCE, JWT_ISSUER } from "@auth/infrastructure/security/JwtTokenService";

app.log.level = "silent";

describe("Correções finais da revisão (HTTP)", () => {
  let token: string;
  before(async () => {
    token = signTestToken(await getTestUserId());
  });
  after(async () => {
    await app.close();
    await prisma.$disconnect();
  });
  const auth = () => ({ authorization: `Bearer ${token}` });

  test("POST /customers com e-mail inválido → mensagem de validação em português", async () => {
    const res = await app.inject({ method: "POST", url: "/customers", headers: auth(), payload: { name: "tx-test-x", email: "nao-e-email" } });
    assert.equal(res.statusCode, 400, res.body);
    const errors = res.json().errors as { field: string; message: string }[];
    assert.ok(errors.length > 0);
    for (const e of errors) {
      assert.ok(!/Invalid input|expected|received/i.test(e.message), e.message);
    }
  });

  test("DELETE /products/:id inexistente → 404 PRODUCT_NOT_FOUND", async () => {
    const res = await app.inject({ method: "DELETE", url: `/products/${randomUUID()}`, headers: auth() });
    assert.equal(res.statusCode, 404, res.body);
    assert.equal(res.json().code, "PRODUCT_NOT_FOUND");
  });

  test("DELETE /variants/:id inexistente → 404 VARIANT_NOT_FOUND", async () => {
    const res = await app.inject({ method: "DELETE", url: `/variants/${randomUUID()}`, headers: auth() });
    assert.equal(res.statusCode, 404, res.body);
    assert.equal(res.json().code, "VARIANT_NOT_FOUND");
  });

  test("token sem claim role usa o papel do banco → 200", async () => {
    const t = jwt.sign({ sub: await getTestUserId() }, process.env.JWT_SECRET!, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
    const res = await app.inject({ method: "GET", url: "/users", headers: { authorization: `Bearer ${t}` } });
    assert.equal(res.statusCode, 200, res.body);
  });

  test("token com payload string → 401 Token inválido", async () => {
    const t = jwt.sign("apenas-texto", process.env.JWT_SECRET!);
    const res = await app.inject({ method: "GET", url: "/users", headers: { authorization: `Bearer ${t}` } });
    assert.equal(res.statusCode, 401, res.body);
    assert.equal(res.json().code, "UNAUTHENTICATED");
  });

  test("GET /users/me com usuário removido → 401 Sessão inválida", async () => {
    const t = signTestToken(randomUUID());
    const res = await app.inject({ method: "GET", url: "/users/me", headers: { authorization: `Bearer ${t}` } });
    assert.equal(res.statusCode, 401, res.body);
    assert.deepEqual(res.json(), { message: "Sessão inválida.", code: "UNAUTHENTICATED" });
  });
});
