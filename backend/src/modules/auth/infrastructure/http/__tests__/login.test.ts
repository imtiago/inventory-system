import "dotenv/config";
import { after, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "@shared/prisma";
import { app } from "../../../../../app";
import {
  LoginAttemptLimiter,
  loginAttemptLimiter,
} from "../../security/LoginAttemptLimiter";
import { createTestUser } from "../../../../../test/authFixtures";

app.log.level = "silent";

const INVALID = { message: "Credenciais inválidas.", code: "INVALID_CREDENTIALS" };
const TOO_MANY = {
  message: "Muitas tentativas. Tente novamente em alguns minutos.",
  code: "TOO_MANY_ATTEMPTS",
};

const login = (email: string, password: string, remoteAddress = "127.0.0.1") =>
  app.inject({ method: "POST", url: "/auth/login", payload: { email, password }, remoteAddress });

describe("POST /auth/login", () => {
  beforeEach(() => loginAttemptLimiter.reset());
  after(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  test("login normaliza e-mail (' Admin@X.com ' entra)", async () => {
    const user = await createTestUser({ role: "ADMIN" });
    try {
      const res = await login(`  ${user.email.toUpperCase()} `, user.password);
      assert.equal(res.statusCode, 200, res.body);
      assert.equal(res.json().data.user.email, user.email);
    } finally {
      await user.cleanup();
    }
  });

  test("login inexistente e inativo → 401 INVALID_CREDENTIALS idênticos", async () => {
    const inactive = await createTestUser({ active: false });
    try {
      const missing = await login(`tx-test-${randomUUID()}@example.com`, inactive.password);
      const inactiveRes = await login(inactive.email, inactive.password);
      const wrong = await login(inactive.email, "senha-errada-123");
      for (const res of [missing, inactiveRes, wrong]) {
        assert.equal(res.statusCode, 401, res.body);
        assert.deepEqual(res.json(), INVALID);
      }
      assert.equal(missing.body, inactiveRes.body);
    } finally {
      await inactive.cleanup();
    }
  });

  test("11ª falha no mesmo IP+e-mail → 429 TOO_MANY_ATTEMPTS; caixa diferente conta junto", async () => {
    const user = await createTestUser();
    try {
      for (let i = 1; i <= 10; i++) {
        // alterna caixa/espaços: tudo conta para a mesma chave normalizada
        const email = i % 2 === 0 ? user.email.toUpperCase() : ` ${user.email} `;
        const res = await login(email, "senha-errada-123");
        assert.equal(res.statusCode, 401, `tentativa ${i}: ${res.body}`);
      }
      const blocked = await login(user.email, "senha-errada-123");
      assert.equal(blocked.statusCode, 429, blocked.body);
      assert.deepEqual(blocked.json(), TOO_MANY);

      // bloqueado mesmo com a senha certa
      const blockedOk = await login(user.email, user.password);
      assert.equal(blockedOk.statusCode, 429, blockedOk.body);

      // outro IP não é afetado
      const otherIp = await login(user.email, user.password, "10.1.2.3");
      assert.equal(otherIp.statusCode, 200, otherIp.body);
    } finally {
      await user.cleanup();
    }
  });

  test("login com sucesso zera o contador e retorna { token, user }", async () => {
    const user = await createTestUser({ role: "VENDEDOR" });
    try {
      for (let i = 0; i < 9; i++) {
        assert.equal((await login(user.email, "senha-errada-123")).statusCode, 401);
      }
      const ok = await login(user.email, user.password);
      assert.equal(ok.statusCode, 200, ok.body);
      const body = ok.json();
      assert.deepEqual(Object.keys(body), ["data"]);
      assert.equal(typeof body.data.token, "string");
      assert.deepEqual(body.data.user, {
        id: user.id,
        name: user.name,
        email: user.email,
        role: "VENDEDOR",
      });

      // o token emitido é aceito pelo authenticate
      const me = await app.inject({
        method: "GET",
        url: "/users/me",
        headers: { authorization: `Bearer ${body.data.token}` },
      });
      assert.equal(me.statusCode, 200, me.body);

      // contador zerado: mais 10 falhas ainda são 401; a 11ª é 429
      for (let i = 1; i <= 10; i++) {
        const res = await login(user.email, "senha-errada-123");
        assert.equal(res.statusCode, 401, `falha ${i} após sucesso: ${res.body}`);
      }
      assert.equal((await login(user.email, "senha-errada-123")).statusCode, 429);
    } finally {
      await user.cleanup();
    }
  });
});

describe("LoginAttemptLimiter", () => {
  test("bloqueia após 10 falhas na janela de 15 min e libera depois dela", () => {
    let now = 1_000_000;
    const limiter = new LoginAttemptLimiter({ now: () => now });
    const key = "1.2.3.4|a@b.com";
    for (let i = 0; i < 9; i++) limiter.registerFailure(key);
    assert.equal(limiter.isBlocked(key), false);
    limiter.registerFailure(key);
    assert.equal(limiter.isBlocked(key), true);
    assert.equal(limiter.isBlocked("1.2.3.4|c@d.com"), false);

    now += 15 * 60 * 1000 + 1;
    assert.equal(limiter.isBlocked(key), false);
  });

  test("clear(key) e reset() zeram contadores", () => {
    const limiter = new LoginAttemptLimiter();
    for (let i = 0; i < 10; i++) limiter.registerFailure("k1");
    for (let i = 0; i < 10; i++) limiter.registerFailure("k2");
    limiter.clear("k1");
    assert.equal(limiter.isBlocked("k1"), false);
    assert.equal(limiter.isBlocked("k2"), true);
    limiter.reset();
    assert.equal(limiter.isBlocked("k2"), false);
  });
});
