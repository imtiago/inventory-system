import "dotenv/config";
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@shared/prisma";
import { app } from "../../../app";
import { createTestUser, signTestToken } from "../../../test/authFixtures";

test("authenticate sem header → 401 Token ausente", async () => {
  const res = await app.inject({ method: "GET", url: "/products" });
  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.json(), { message: "Token ausente.", code: "UNAUTHENTICATED" });
});

test("authenticate token inválido → 401 Token inválido", async () => {
  const res = await app.inject({
    method: "GET",
    url: "/products",
    headers: { authorization: "Bearer lixo" },
  });
  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.json(), { message: "Token inválido.", code: "UNAUTHENTICATED" });
});

test("rota pública com query string continua pública", async () => {
  const res = await app.inject({
    method: "POST",
    url: "/auth/login?x=1",
    payload: {},
  });
  assert.notEqual(res.statusCode, 401);
});

test("authorize papel ausente → 403 FORBIDDEN", async () => {
  // papel vem do banco: ESTOQUISTA não está entre os permitidos em GET /users
  const user = await createTestUser({ role: "ESTOQUISTA" });
  try {
    const token = signTestToken(user.id, "cliente");
    const res = await app.inject({
      method: "GET",
      url: "/users",
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(res.statusCode, 403);
    assert.deepEqual(res.json(), { message: "Acesso negado.", code: "FORBIDDEN" });
  } finally {
    await user.cleanup();
  }
});

after(async () => {
  await app.close();
  await prisma.$disconnect();
});
