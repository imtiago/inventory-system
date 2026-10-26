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

describe("POST /auth/login — limites por conta e por IP", () => {
  beforeEach(() => loginAttemptLimiter.reset());

  test("31ª falha na mesma conta vinda de IPs diferentes → 429", async () => {
    const user = await createTestUser();
    try {
      for (let i = 0; i < 30; i++) {
        const res = await login(user.email, "senha-errada-123", `10.1.0.${i + 1}`);
        assert.equal(res.statusCode, 401, `falha ${i + 1}: ${res.body}`);
      }
      const blocked = await login(user.email, "senha-errada-123", "10.9.9.9");
      assert.equal(blocked.statusCode, 429, blocked.body);
      assert.deepEqual(blocked.json(), TOO_MANY);
    } finally {
      await user.cleanup();
    }
  });

  test("51ª falha do mesmo IP com e-mails diferentes → 429", async () => {
    for (let i = 0; i < 50; i++) {
      const res = await login(`nobody-${i}@example.com`, "senha-errada-123", "10.2.0.1");
      assert.equal(res.statusCode, 401, `falha ${i + 1}: ${res.body}`);
    }
    const blocked = await login("nobody-x@example.com", "senha-errada-123", "10.2.0.1");
    assert.equal(blocked.statusCode, 429, blocked.body);
    assert.deepEqual(blocked.json(), TOO_MANY);
  });

  test("login bem-sucedido na própria conta não zera o contador por IP", async () => {
    const own = await createTestUser();
    try {
      for (let i = 0; i < 50; i++) {
        if (i % 5 === 0) assert.equal((await login(own.email, own.password, "10.3.0.1")).statusCode, 200);
        const res = await login(`nobody-${i}@example.com`, "senha-errada-123", "10.3.0.1");
        assert.equal(res.statusCode, 401, `falha ${i + 1}: ${res.body}`);
      }
      assert.equal((await login("nobody-z@example.com", "senha-errada-123", "10.3.0.1")).statusCode, 429);
    } finally {
      await own.cleanup();
    }
  });
});

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

  test("20 falhas concorrentes no mesmo IP+e-mail → no máximo 10 respostas 401, o resto 429", async () => {
    const user = await createTestUser();
    try {
      const results = await Promise.all(
        Array.from({ length: 20 }, () => login(user.email, "senha-errada-123")),
      );
      const codes = results.map((r) => r.statusCode);
      const unauthorized = codes.filter((c) => c === 401).length;
      const tooMany = codes.filter((c) => c === 429).length;
      assert.ok(unauthorized <= 10, `401s: ${unauthorized} (${codes.join(",")})`);
      assert.equal(unauthorized + tooMany, 20, codes.join(","));
    } finally {
      await user.cleanup();
    }
  });

  test("senha vazia ou acima de 1024 caracteres → 400 VALIDATION_ERROR", async () => {
    for (const password of ["", "x".repeat(1025)]) {
      const res = await login(`tx-test-${randomUUID()}@example.com`, password);
      assert.equal(res.statusCode, 400, res.body);
      assert.equal(res.json().code, "VALIDATION_ERROR");
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
  test("tryConsume aceita 10 tentativas na janela de 15 min e libera depois dela", () => {
    let now = 1_000_000;
    const limiter = new LoginAttemptLimiter({ now: () => now });
    const key = "1.2.3.4|a@b.com";
    for (let i = 0; i < 10; i++) assert.equal(limiter.tryConsume(key), true, `tentativa ${i + 1}`);
    assert.equal(limiter.tryConsume(key), false);
    assert.equal(limiter.tryConsume(key), false);
    assert.equal(limiter.tryConsume("1.2.3.4|c@d.com"), true);

    now += 15 * 60 * 1000 + 1;
    assert.equal(limiter.tryConsume(key), true);
  });

  test("clear(key) e reset() zeram contadores", () => {
    const limiter = new LoginAttemptLimiter();
    for (let i = 0; i < 10; i++) limiter.tryConsume("k1");
    for (let i = 0; i < 10; i++) limiter.tryConsume("k2");
    limiter.clear("k1");
    assert.equal(limiter.tryConsume("k1"), true);
    assert.equal(limiter.tryConsume("k2"), false);
    limiter.reset();
    assert.equal(limiter.tryConsume("k2"), true);
  });

  test("memória limitada: acima de maxEntries descarta as chaves mais antigas", () => {
    const limiter = new LoginAttemptLimiter({ maxEntries: 3 });
    for (let i = 0; i < 10; i++) limiter.tryConsume("antiga");
    limiter.tryConsume("b");
    limiter.tryConsume("c");
    limiter.tryConsume("d"); // excede o limite: "antiga" é descartada
    assert.equal(limiter.size, 3);
    assert.equal(limiter.tryConsume("antiga"), true);
    assert.ok(limiter.size <= 3);
  });
});
