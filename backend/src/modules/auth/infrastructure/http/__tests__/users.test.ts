import "dotenv/config";
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import jwt from "jsonwebtoken";
import { prisma } from "@shared/prisma";
import { app } from "../../../../../app";
import { keyShape } from "../../../../../test/keyShape";
import { createTestUser, signTestToken, TestUser } from "../../../../../test/authFixtures";
import { loginAttemptLimiter } from "@auth/infrastructure/security/LoginAttemptLimiter";

app.log.level = "silent";

const FIXTURES_DIR = new URL("../../../../../../../frontend/src/test/fixtures/users/", import.meta.url);
const loadFixture = (name: string): unknown =>
  JSON.parse(readFileSync(new URL(`${name}.json`, FIXTURES_DIR), "utf8"));

// Todo e-mail gerado aqui é apagado no after(), mesmo se o teste falhar no meio.
const generatedEmails: string[] = [];
const newEmail = () => {
  const email = `tx-test-${randomUUID()}@example.com`;
  generatedEmails.push(email);
  return email;
};
const USER_DTO_KEYS = ["active", "createdAt", "email", "id", "name", "role"];

describe("Gestão de usuários (/users)", () => {
  let admin: TestUser;
  let vendedor: TestUser;
  let estoquista: TestUser;
  const createdIds: string[] = [];

  const call = (
    method: "GET" | "POST" | "PUT" | "PATCH",
    url: string,
    token?: string,
    payload?: object,
  ) =>
    app.inject({
      method,
      url,
      payload,
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });

  const createViaApi = async (role: "ADMIN" | "VENDEDOR" | "ESTOQUISTA", name = "tx-test-api") => {
    const email = newEmail();
    const res = await call("POST", "/users", admin.token, {
      name,
      email,
      password: "senha-inicial",
      role,
    });
    assert.equal(res.statusCode, 201, res.body);
    createdIds.push(res.json().data.id);
    return res.json().data as { id: string; email: string; role: string };
  };

  before(async () => {
    admin = await createTestUser({ role: "ADMIN" });
    vendedor = await createTestUser({ role: "VENDEDOR" });
    estoquista = await createTestUser({ role: "ESTOQUISTA" });
  });

  after(async () => {
    await prisma.user.deleteMany({
      where: { OR: [{ id: { in: createdIds } }, { email: { in: generatedEmails } }] },
    });
    await admin.cleanup();
    await vendedor.cleanup();
    await estoquista.cleanup();
    await app.close();
    await prisma.$disconnect();
  });

  test("POST /users sem token → 401; VENDEDOR → 403; ADMIN cria com papel ESTOQUISTA", async () => {
    const payload = { name: "tx-test-novo", email: newEmail(), password: "senha-segura", role: "ESTOQUISTA" };

    const anon = await call("POST", "/users", undefined, payload);
    assert.equal(anon.statusCode, 401, anon.body);

    const asSeller = await call("POST", "/users", vendedor.token, payload);
    assert.equal(asSeller.statusCode, 403, asSeller.body);

    const res = await call("POST", "/users", admin.token, {
      ...payload,
      email: `  ${payload.email.toUpperCase()} `,
    });
    assert.equal(res.statusCode, 201, res.body);
    const body = res.json();
    createdIds.push(body.data.id);
    assert.deepEqual(Object.keys(body), ["data"]);
    assert.deepEqual(Object.keys(body.data).sort(), USER_DTO_KEYS);
    assert.equal(body.data.email, payload.email); // normalizado
    assert.equal(body.data.role, "ESTOQUISTA");
    assert.equal(body.data.active, true);
    assert.equal(body.data.password, undefined);

    const dup = await call("POST", "/users", admin.token, payload);
    assert.equal(dup.statusCode, 409, dup.body);
    assert.equal(dup.json().code, "EMAIL_ALREADY_IN_USE");

    const weak = await call("POST", "/users", admin.token, { ...payload, email: newEmail(), password: "curta" });
    assert.equal(weak.statusCode, 400, weak.body);
    const badRole = await call("POST", "/users", admin.token, { ...payload, email: newEmail(), role: "CLIENTE" });
    assert.equal(badRole.statusCode, 400, badRole.body);
  });

  test("papel vem do banco: token de VENDEDOR assinado com role ADMIN → 403 em rota users.manage", async () => {
    const forged = signTestToken(vendedor.id, "ADMIN");
    const res = await call("GET", "/users", forged);
    assert.equal(res.statusCode, 403, res.body);
    assert.deepEqual(res.json(), { message: "Acesso negado.", code: "FORBIDDEN" });
  });

  test("GET /users busca e pagina; só admin", async () => {
    const tag = `tx-test-busca-${randomUUID()}`;
    const a = await createViaApi("VENDEDOR", `${tag} A`);
    const b = await createViaApi("VENDEDOR", `${tag} B`);

    const page1 = await call("GET", `/users?search=${encodeURIComponent(tag.toUpperCase())}&limit=1&page=1`, admin.token);
    assert.equal(page1.statusCode, 200, page1.body);
    const body1 = page1.json();
    assert.deepEqual(Object.keys(body1).sort(), ["data", "pagination"]);
    assert.equal(body1.data.length, 1);
    assert.deepEqual(body1.pagination, { page: 1, limit: 1, total: 2, totalPages: 2 });
    assert.deepEqual(Object.keys(body1.data[0]).sort(), USER_DTO_KEYS);

    const page2 = await call("GET", `/users?search=${encodeURIComponent(tag)}&limit=1&page=2`, admin.token);
    const ids = [body1.data[0].id, page2.json().data[0].id].sort();
    assert.deepEqual(ids, [a.id, b.id].sort());

    // busca por e-mail
    const byEmail = await call("GET", `/users?search=${encodeURIComponent(a.email)}`, admin.token);
    assert.deepEqual(byEmail.json().data.map((u: { id: string }) => u.id), [a.id]);

    assert.equal((await call("GET", "/users?limit=101", admin.token)).statusCode, 400);
    assert.equal((await call("GET", "/users", vendedor.token)).statusCode, 403);
    assert.equal((await call("GET", "/users", estoquista.token)).statusCode, 403);
  });

  test("GET /users/:id → { data: UserDTO }; inexistente → 404 USER_NOT_FOUND; id inválido → 400", async () => {
    const res = await call("GET", `/users/${estoquista.id}`, admin.token);
    assert.equal(res.statusCode, 200, res.body);
    assert.deepEqual(res.json().data, {
      id: estoquista.id,
      name: estoquista.name,
      email: estoquista.email,
      role: "ESTOQUISTA",
      active: true,
      createdAt: res.json().data.createdAt,
    });

    const missing = await call("GET", `/users/${randomUUID()}`, admin.token);
    assert.equal(missing.statusCode, 404);
    assert.equal(missing.json().code, "USER_NOT_FOUND");
    assert.equal((await call("GET", "/users/nao-e-uuid", admin.token)).statusCode, 400);
    assert.equal((await call("GET", `/users/${estoquista.id}`, vendedor.token)).statusCode, 403);
  });

  test("PATCH /users/:id muda papel/ativo; admin não desativa a si → 409 CANNOT_CHANGE_OWN_ACCESS", async () => {
    const target = await createViaApi("VENDEDOR");

    const res = await call("PATCH", `/users/${target.id}`, admin.token, {
      name: "tx-test-renomeado",
      role: "ESTOQUISTA",
      active: false,
    });
    assert.equal(res.statusCode, 200, res.body);
    assert.deepEqual(
      { name: res.json().data.name, role: res.json().data.role, active: res.json().data.active },
      { name: "tx-test-renomeado", role: "ESTOQUISTA", active: false },
    );
    // desativado perde a sessão
    const me = await call("GET", "/users/me", signTestToken(target.id));
    assert.equal(me.statusCode, 401);

    // rebaixar um ADMIN (há outros ativos) é permitido
    const otherAdmin = await createViaApi("ADMIN");
    const demote = await call("PATCH", `/users/${otherAdmin.id}`, admin.token, { role: "VENDEDOR" });
    assert.equal(demote.statusCode, 200, demote.body);
    assert.equal(demote.json().data.role, "VENDEDOR");

    for (const payload of [{ active: false }, { role: "VENDEDOR" }, { role: "ESTOQUISTA", active: true }]) {
      const self = await call("PATCH", `/users/${admin.id}`, admin.token, payload);
      assert.equal(self.statusCode, 409, `${JSON.stringify(payload)}: ${self.body}`);
      assert.equal(self.json().code, "CANNOT_CHANGE_OWN_ACCESS");
    }
    // o próprio nome pode mudar
    const rename = await call("PATCH", `/users/${admin.id}`, admin.token, { name: "tx-test-admin" });
    assert.equal(rename.statusCode, 200, rename.body);
    assert.equal(rename.json().data.role, "ADMIN");
    assert.equal(rename.json().data.active, true);

    assert.equal((await call("PATCH", `/users/${randomUUID()}`, admin.token, { name: "x" })).statusCode, 404);
    assert.equal((await call("PATCH", `/users/${target.id}`, admin.token, {})).statusCode, 400);
    assert.equal((await call("PATCH", `/users/${target.id}`, vendedor.token, { name: "x" })).statusCode, 403);
  });

  test("POST /users/:id/password redefine; login com a nova funciona", async () => {
    const target = await createViaApi("VENDEDOR");
    loginAttemptLimiter.reset();

    // sessão aberta antes da redefinição (iat um segundo antes)
    const oldSession = jwt.sign(
      { sub: target.id, role: "VENDEDOR", iat: Math.floor(Date.now() / 1000) - 1 },
      process.env.JWT_SECRET!,
      { expiresIn: "1h", issuer: "my-api", audience: "my-api-client" },
    );
    assert.equal((await call("GET", "/users/me", oldSession)).statusCode, 200);

    const res = await call("POST", `/users/${target.id}/password`, admin.token, { password: "nova-senha-123" });
    assert.equal(res.statusCode, 204, res.body);
    assert.equal(res.body, "");

    const afterReset = await call("GET", "/users/me", oldSession);
    assert.equal(afterReset.statusCode, 401, afterReset.body);
    assert.deepEqual(afterReset.json(), { message: "Sessão inválida.", code: "UNAUTHENTICATED" });
    // a sessão do admin que redefiniu continua valendo
    assert.equal((await call("GET", "/users/me", admin.token)).statusCode, 200);

    const oldLogin = await call("POST", "/auth/login", undefined, { email: target.email, password: "senha-inicial" });
    assert.equal(oldLogin.statusCode, 401);
    const newLogin = await call("POST", "/auth/login", undefined, { email: target.email, password: "nova-senha-123" });
    assert.equal(newLogin.statusCode, 200, newLogin.body);

    assert.equal((await call("POST", `/users/${target.id}/password`, admin.token, { password: "curta" })).statusCode, 400);
    assert.equal(
      (await call("POST", `/users/${randomUUID()}/password`, admin.token, { password: "nova-senha-123" })).json().code,
      "USER_NOT_FOUND",
    );
    assert.equal(
      (await call("POST", `/users/${target.id}/password`, vendedor.token, { password: "nova-senha-123" })).statusCode,
      403,
    );
  });

  test("PUT /users/me/password com atual errada → 422 INVALID_CURRENT_PASSWORD; certa → 200 com token novo", async () => {
    const user = await createTestUser({ role: "ESTOQUISTA", password: "senha-atual-1" });
    try {
      const wrong = await call("PUT", "/users/me/password", user.token, {
        currentPassword: "senha-errada",
        newPassword: "senha-nova-12",
      });
      assert.equal(wrong.statusCode, 422, wrong.body);
      assert.equal(wrong.json().code, "INVALID_CURRENT_PASSWORD");

      const weak = await call("PUT", "/users/me/password", user.token, {
        currentPassword: "senha-atual-1",
        newPassword: "curta",
      });
      assert.equal(weak.statusCode, 400, weak.body);

      const oldSession = jwt.sign(
        { sub: user.id, role: "ESTOQUISTA", iat: Math.floor(Date.now() / 1000) - 1 },
        process.env.JWT_SECRET!,
        { expiresIn: "1h", issuer: "my-api", audience: "my-api-client" },
      );
      const ok = await call("PUT", "/users/me/password", user.token, {
        currentPassword: "senha-atual-1",
        newPassword: "senha-nova-12",
      });
      assert.equal(ok.statusCode, 200, ok.body);
      assert.deepEqual(Object.keys(ok.json()), ["data"]);
      assert.deepEqual(Object.keys(ok.json().data), ["token"]);
      const newToken: string = ok.json().data.token;
      assert.equal(typeof newToken, "string");

      // sessão anterior à troca cai; o token devolvido continua logado
      const stale = await call("GET", "/users/me", oldSession);
      assert.equal(stale.statusCode, 401, stale.body);
      assert.deepEqual(stale.json(), { message: "Sessão inválida.", code: "UNAUTHENTICATED" });
      const me = await call("GET", "/users/me", newToken);
      assert.equal(me.statusCode, 200, me.body);
      assert.equal(me.json().data.id, user.id);

      loginAttemptLimiter.reset();
      const login = await call("POST", "/auth/login", undefined, { email: user.email, password: "senha-nova-12" });
      assert.equal(login.statusCode, 200, login.body);
    } finally {
      await user.cleanup();
    }
  });

  test("PUT /users/me/password: 10 senhas atuais erradas → 422; a 11ª → 429 TOO_MANY_ATTEMPTS", async () => {
    const user = await createTestUser({ role: "VENDEDOR", password: "senha-atual-1" });
    try {
      const attempt = (currentPassword: string) =>
        call("PUT", "/users/me/password", user.token, { currentPassword, newPassword: "senha-nova-12" });
      for (let i = 1; i <= 10; i++) {
        const res = await attempt("senha-errada");
        assert.equal(res.statusCode, 422, `tentativa ${i}: ${res.body}`);
      }
      const blocked = await attempt("senha-atual-1");
      assert.equal(blocked.statusCode, 429, blocked.body);
      assert.deepEqual(blocked.json(), {
        message: "Muitas tentativas. Tente novamente em alguns minutos.",
        code: "TOO_MANY_ATTEMPTS",
      });
    } finally {
      await user.cleanup();
    }
  });

  test("nome com mais de 120 caracteres → 400 (criar e editar)", async () => {
    const long = "x".repeat(121);
    const create = await call("POST", "/users", admin.token, {
      name: long,
      email: newEmail(),
      password: "senha-segura",
      role: "VENDEDOR",
    });
    assert.equal(create.statusCode, 400, create.body);
    const patch = await call("PATCH", `/users/${estoquista.id}`, admin.token, { name: long });
    assert.equal(patch.statusCode, 400, patch.body);
    const ok = await call("PATCH", `/users/${estoquista.id}`, admin.token, { name: "x".repeat(120) });
    assert.equal(ok.statusCode, 200, ok.body);
  });

  test("ESTOQUISTA acessa GET /users/me", async () => {
    const res = await call("GET", "/users/me", estoquista.token);
    assert.equal(res.statusCode, 200, res.body);
    assert.deepEqual(Object.keys(res.json()), ["data"]);
    assert.equal(res.json().data.id, estoquista.id);
    assert.equal(res.json().data.role, "ESTOQUISTA");
    assert.deepEqual(Object.keys(res.json().data).sort(), USER_DTO_KEYS);
  });

  test("contrato: GET /users e GET /users/:id com as chaves das fixtures do frontend", async () => {
    const list = await call("GET", `/users?search=${encodeURIComponent(estoquista.email)}`, admin.token);
    assert.equal(list.statusCode, 200, list.body);
    assert.deepEqual(keyShape(list.json()), keyShape(loadFixture("userList")));

    const one = await call("GET", `/users/${estoquista.id}`, admin.token);
    assert.deepEqual(keyShape(one.json()), keyShape(loadFixture("user")));
  });
});
