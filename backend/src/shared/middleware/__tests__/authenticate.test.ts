import "dotenv/config";
import { after, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import type { FastifyRequest } from "fastify";
import { prisma } from "@shared/prisma";
import { app } from "../../../app";
import { authenticate } from "../auth";
import { createTestUser, signTestToken } from "../../../test/authFixtures";

app.log.level = "silent";

const SESSION_INVALID = { message: "Sessão inválida.", code: "UNAUTHENTICATED" };
const TOKEN_INVALID = { message: "Token inválido.", code: "UNAUTHENTICATED" };

describe("authenticate (JWT estrito + sessão verificada no banco)", () => {
  after(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  const getMe = (authorization: string) =>
    app.inject({ method: "GET", url: "/users/me", headers: { authorization } });

  test("Authorization sem 'Bearer ' → 401", async () => {
    const user = await createTestUser();
    try {
      const token = signTestToken(user.id);
      for (const header of [token, `Basic ${token}`, `bearer${token}`, "Bearer"]) {
        const res = await getMe(header);
        assert.equal(res.statusCode, 401, `${header}: ${res.body}`);
        assert.deepEqual(res.json(), { message: "Token ausente.", code: "UNAUTHENTICATED" });
      }
    } finally {
      await user.cleanup();
    }
  });

  test("token com issuer/audience errados → 401", async () => {
    const user = await createTestUser();
    try {
      const tokens = [
        signTestToken(user.id, "ADMIN", { issuer: "outra-api" }),
        signTestToken(user.id, "ADMIN", { audience: "outro-cliente" }),
        jwt.sign({ sub: user.id, role: "ADMIN" }, process.env.JWT_SECRET!), // sem iss/aud
        signTestToken(user.id, "ADMIN", { algorithm: "HS512" }),
        signTestToken(user.id, "ADMIN", { expiresIn: -10 }),
      ];
      for (const token of tokens) {
        const res = await getMe(`Bearer ${token}`);
        assert.equal(res.statusCode, 401, res.body);
        assert.deepEqual(res.json(), TOKEN_INVALID);
      }
      // controle: o mesmo usuário com token correto entra
      const ok = await getMe(`Bearer ${signTestToken(user.id)}`);
      assert.equal(ok.statusCode, 200, ok.body);
    } finally {
      await user.cleanup();
    }
  });

  test("usuário desativado com token válido → 401 'Sessão inválida.'", async () => {
    const user = await createTestUser({ role: "ADMIN" });
    try {
      const token = signTestToken(user.id);
      assert.equal((await getMe(`Bearer ${token}`)).statusCode, 200);

      await prisma.user.update({ where: { id: user.id }, data: { active: false } });

      const res = await getMe(`Bearer ${token}`);
      assert.equal(res.statusCode, 401, res.body);
      assert.deepEqual(res.json(), SESSION_INVALID);
      // vale também para rotas sob o hook global (ex.: /products)
      const res2 = await app.inject({
        method: "GET",
        url: "/products",
        headers: { authorization: `Bearer ${token}` },
      });
      assert.equal(res2.statusCode, 401, res2.body);
      assert.deepEqual(res2.json(), SESSION_INVALID);
    } finally {
      await user.cleanup();
    }
  });

  test("usuário apagado com token válido → 401 (não 500)", async () => {
    for (const sub of [randomUUID(), "nao-e-uuid"]) {
      const res = await getMe(`Bearer ${signTestToken(sub)}`);
      assert.equal(res.statusCode, 401, res.body);
      assert.deepEqual(res.json(), SESSION_INVALID);
    }
  });

  test("papel vem do banco: token com role ADMIN de um VENDEDOR não dá acesso de admin", async () => {
    const vendedor = await createTestUser({ role: "VENDEDOR" });
    const estoquista = await createTestUser({ role: "ESTOQUISTA" });
    try {
      const request = {
        headers: { authorization: `Bearer ${signTestToken(vendedor.id, "ADMIN")}` },
      } as unknown as FastifyRequest;
      await authenticate(request);
      assert.deepEqual(request.user, { sub: vendedor.id, role: "VENDEDOR" });

      // Hoje GET /users não permite ESTOQUISTA: a claim "admin" não deve contornar isso.
      const res = await app.inject({
        method: "GET",
        url: "/users",
        headers: { authorization: `Bearer ${signTestToken(estoquista.id, "admin")}` },
      });
      assert.equal(res.statusCode, 403, res.body);
      assert.deepEqual(res.json(), { message: "Acesso negado.", code: "FORBIDDEN" });
    } finally {
      await vendedor.cleanup();
      await estoquista.cleanup();
    }
  });
});
