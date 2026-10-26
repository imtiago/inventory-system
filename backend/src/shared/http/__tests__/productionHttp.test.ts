import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildApp, RATE_LIMIT_DEFAULTS } from "../../../app";
import { signTestToken } from "../../../test/authFixtures";

const quiet = { logger: false } as const;

test("GET /health público: 200 { status: ok } sem token", async () => {
  const app = buildApp({ ...quiet, healthCheck: async () => {} });
  const res = await app.inject({ method: "GET", url: "/health" });
  await app.close();
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.json(), { status: "ok" });
});

test("GET /health com banco fora: 503 { status: unavailable }", async () => {
  const app = buildApp({
    ...quiet,
    healthCheck: async () => {
      throw new Error("connection refused");
    },
  });
  const res = await app.inject({ method: "GET", url: "/health" });
  await app.close();
  assert.equal(res.statusCode, 503);
  assert.deepEqual(res.json(), { status: "unavailable" });
});

test("helmet: cabeçalhos de segurança presentes", async () => {
  const app = buildApp({ ...quiet, healthCheck: async () => {} });
  const res = await app.inject({ method: "GET", url: "/health" });
  await app.close();
  assert.equal(res.headers["x-content-type-options"], "nosniff");
  assert.ok(res.headers["content-security-policy"]);
  assert.ok(res.headers["x-frame-options"]);
});

test("helmet fora de produção: sem HSTS nem upgrade-insecure-requests (não prende localhost em HTTPS)", async () => {
  const app = buildApp({ ...quiet, healthCheck: async () => {} });
  const res = await app.inject({ method: "GET", url: "/health" });
  await app.close();
  assert.equal(res.headers["strict-transport-security"], undefined);
  assert.doesNotMatch(String(res.headers["content-security-policy"]), /upgrade-insecure-requests/);
});

test("rate limit: 429 RATE_LIMITED com Retry-After; /health fora do limite", async () => {
  const app = buildApp({
    ...quiet,
    healthCheck: async () => {},
    rateLimit: { max: 2, reportsMax: 1 },
  });
  const codes: number[] = [];
  for (let i = 0; i < 3; i++) {
    const r = await app.inject({ method: "GET", url: "/nada" });
    codes.push(r.statusCode);
    if (i === 2) {
      assert.deepEqual(r.json(), {
        message: "Muitas requisições. Aguarde um instante e tente novamente.",
        code: "RATE_LIMITED",
      });
      assert.ok(Number(r.headers["retry-after"]) > 0);
    }
  }
  // /health nunca é limitado
  for (let i = 0; i < 5; i++) {
    const h = await app.inject({ method: "GET", url: "/health" });
    assert.equal(h.statusCode, 200);
  }
  await app.close();
  // /nada cai na 401 (rota não pública sem token) até estourar o limite
  assert.deepEqual(codes, [401, 401, 429]);
});

test("rate limit: /reports/* tem limite próprio", async () => {
  const app = buildApp({
    ...quiet,
    healthCheck: async () => {},
    rateLimit: { max: 100, reportsMax: 1 },
  });
  const a = await app.inject({ method: "GET", url: "/reports/sales.csv" });
  const b = await app.inject({ method: "GET", url: "/reports/sales.csv" });
  const c = await app.inject({ method: "GET", url: "/products" });
  await app.close();
  assert.equal(a.statusCode, 401);
  assert.equal(b.statusCode, 429);
  assert.equal(c.statusCode, 401);
});

test("CORS com lista: recusa origem fora, aceita a listada", async () => {
  const app = buildApp({
    ...quiet,
    healthCheck: async () => {},
    corsOrigins: ["https://app.exemplo.com"],
  });
  const ok = await app.inject({
    method: "GET",
    url: "/health",
    headers: { origin: "https://app.exemplo.com" },
  });
  const bad = await app.inject({
    method: "GET",
    url: "/health",
    headers: { origin: "https://evil.com" },
  });
  await app.close();
  assert.equal(ok.headers["access-control-allow-origin"], "https://app.exemplo.com");
  assert.equal(bad.headers["access-control-allow-origin"], undefined);
});

test("JSON malformado → 400 INVALID_JSON", async () => {
  const app = buildApp({ ...quiet, healthCheck: async () => {} });
  const res = await app.inject({
    method: "POST",
    url: "/auth/login",
    headers: { "content-type": "application/json" },
    payload: "{oops",
  });
  await app.close();
  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.json(), { message: "JSON inválido.", code: "INVALID_JSON" });
});

test("corpo acima de 1 MiB → 413 PAYLOAD_TOO_LARGE", async () => {
  const app = buildApp({ ...quiet, healthCheck: async () => {} });
  const res = await app.inject({
    method: "POST",
    url: "/auth/login",
    headers: { "content-type": "application/json" },
    payload: JSON.stringify({ email: "a@b.com", password: "x".repeat(1024 * 1024 + 10) }),
  });
  await app.close();
  assert.equal(res.statusCode, 413);
  assert.deepEqual(res.json(), {
    message: "Arquivo ou requisição grande demais.",
    code: "PAYLOAD_TOO_LARGE",
  });
});

test("content-type não suportado → 415 UNSUPPORTED_MEDIA_TYPE", async () => {
  const app = buildApp({ ...quiet, healthCheck: async () => {} });
  const res = await app.inject({
    method: "POST",
    url: "/auth/login",
    headers: { "content-type": "application/xml" },
    payload: "<a/>",
  });
  await app.close();
  assert.equal(res.statusCode, 415);
  assert.deepEqual(res.json(), {
    message: "Tipo de conteúdo não suportado.",
    code: "UNSUPPORTED_MEDIA_TYPE",
  });
});

test("desligamento gracioso: app.close() espera a requisição em andamento", async () => {
  const app = buildApp({
    ...quiet,
    healthCheck: async () => {
      await new Promise((r) => setTimeout(r, 300));
    },
  });
  await app.listen({ port: 0, host: "127.0.0.1" });
  const addr = app.server.address() as { port: number };
  const pending = fetch(`http://127.0.0.1:${addr.port}/health`, {
    headers: { connection: "close" },
  });
  await new Promise((r) => setTimeout(r, 50));
  await app.close();
  const res = await pending;
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { status: "ok" });
});

test("rate limit: /%72eports/* (codificado) cai no limite de /reports", async () => {
  const app = buildApp({
    ...quiet,
    healthCheck: async () => {},
    rateLimit: { max: 100, reportsMax: 1 },
  });
  const a = await app.inject({ method: "GET", url: "/%72eports/sales.csv" });
  const b = await app.inject({ method: "GET", url: "/reports/sales.csv" });
  await app.close();
  assert.equal(a.statusCode, 401);
  assert.equal(b.statusCode, 429);
});

test("/%68ealth (codificado) se comporta como /health: público e fora do limite", async () => {
  const app = buildApp({
    ...quiet,
    healthCheck: async () => {},
    rateLimit: { max: 1, reportsMax: 1 },
  });
  for (let i = 0; i < 3; i++) {
    const r = await app.inject({ method: "GET", url: "/%68ealth" });
    assert.equal(r.statusCode, 200);
  }
  await app.close();
});

test("rota inexistente continua exigindo token (nunca pula a auth)", async () => {
  const app = buildApp({ ...quiet, healthCheck: async () => {}, rateLimit: false });
  const a = await app.inject({ method: "GET", url: "/health/" });
  const b = await app.inject({ method: "GET", url: "/%61uth/login" });
  await app.close();
  assert.equal(a.statusCode, 401);
  assert.notEqual(b.statusCode, 200);
});

test("rate limit: limites padrão são 300/min na API e 20/min em /reports", () => {
  assert.deepEqual(RATE_LIMIT_DEFAULTS, { max: 300, reportsMax: 20 });
});

test("rate limit: a chave é o usuário do token assinado (mesmo IP, baldes separados); token inválido cai no IP", async () => {
  const app = buildApp({ ...quiet, healthCheck: async () => {}, rateLimit: { max: 2, reportsMax: 1 } });
  const get = (token?: string) =>
    app.inject({
      method: "GET",
      url: "/products",
      remoteAddress: "10.1.2.3",
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
  const tokenA = signTestToken("user-a-rate");
  const tokenB = signTestToken("user-b-rate");
  const statuses = async (calls: Array<string | undefined>) => {
    const out: number[] = [];
    for (const t of calls) out.push((await get(t)).statusCode);
    return out;
  };
  // Usuário A esgota o balde dele (401 = passou do limite e caiu na autenticação) ...
  assert.deepEqual(await statuses([tokenA, tokenA, tokenA]), [401, 401, 429]);
  // ... e o usuário B, no mesmo IP, tem o próprio balde.
  assert.deepEqual(await statuses([tokenB, tokenB]), [401, 401]);
  // Token com assinatura inválida e requisições sem token compartilham o balde do IP.
  assert.deepEqual(await statuses(["lixo.lixo.lixo", undefined, "outro.lixo.token"]), [401, 401, 429]);
  await app.close();
});
