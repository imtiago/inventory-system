import { test } from "node:test";
import assert from "node:assert/strict";
import { loadEnv } from "../env";

const base = {
  DATABASE_URL: "postgresql://u:p@localhost:5432/db",
  JWT_SECRET: "abc",
};

test("loadEnv aplica padrões e retorna os valores", () => {
  const env = loadEnv(base);
  assert.equal(env.JWT_SECRET, "abc");
  assert.equal(env.PORT, 3000);
  assert.equal(env.HOST, "0.0.0.0");
  assert.equal(env.CORS_ORIGINS, undefined);
  assert.equal(env.TRUST_PROXY, undefined);
  assert.equal(env.isProduction, false);
});

test("loadEnv lista as variáveis inválidas", () => {
  assert.throws(
    () => loadEnv({ DATABASE_URL: "nao-e-url", PORT: "99999" }),
    (err: Error) => {
      assert.match(err.message, /Variáveis de ambiente inválidas/);
      assert.match(err.message, /DATABASE_URL/);
      assert.match(err.message, /JWT_SECRET/);
      assert.match(err.message, /PORT/);
      return true;
    },
  );
});

test("JWT_SECRET vazio é inválido", () => {
  assert.throws(() => loadEnv({ ...base, JWT_SECRET: "" }), /JWT_SECRET/);
});

test("produção: JWT_SECRET curto não sobe", () => {
  assert.throws(
    () => loadEnv({ ...base, NODE_ENV: "production", CORS_ORIGINS: "https://a.com" }),
    /JWT_SECRET/,
  );
});

test("produção: sem CORS_ORIGINS não sobe", () => {
  assert.throws(
    () => loadEnv({ ...base, NODE_ENV: "production", JWT_SECRET: "x".repeat(32) }),
    /CORS_ORIGINS/,
  );
});

test("produção válida; CORS_ORIGINS vira lista", () => {
  const env = loadEnv({
    ...base,
    NODE_ENV: "production",
    JWT_SECRET: "x".repeat(32),
    CORS_ORIGINS: "https://a.com, https://b.com",
    COMPANY_CNPJ: "11.444.777/0001-61",
  });
  assert.equal(env.COMPANY_CNPJ, "11444777000161");
  assert.deepEqual(env.CORS_ORIGINS, ["https://a.com", "https://b.com"]);
  assert.equal(env.isProduction, true);
});

test("fora de produção segredo curto é aceito (CI)", () => {
  assert.doesNotThrow(() => loadEnv({ ...base, JWT_SECRET: "ci-only-secret" }));
});

test("TRUST_PROXY: true, número de saltos ou lista de IPs", () => {
  assert.equal(loadEnv({ ...base, TRUST_PROXY: "true" }).TRUST_PROXY, true);
  assert.equal(loadEnv({ ...base, TRUST_PROXY: "false" }).TRUST_PROXY, undefined);
  assert.equal(loadEnv({ ...base, TRUST_PROXY: "2" }).TRUST_PROXY, 2);
  assert.deepEqual(loadEnv({ ...base, TRUST_PROXY: "10.0.0.1, 10.0.0.2" }).TRUST_PROXY, [
    "10.0.0.1",
    "10.0.0.2",
  ]);
});

test("RATE_LIMIT_DISABLED só vale fora de produção", () => {
  assert.equal(loadEnv({ ...base, RATE_LIMIT_DISABLED: "1" }).RATE_LIMIT_DISABLED, true);
  assert.equal(
    loadEnv({
      ...base,
      NODE_ENV: "production",
      JWT_SECRET: "x".repeat(32),
      CORS_ORIGINS: "https://a.com",
      COMPANY_CNPJ: "11444777000161",
      RATE_LIMIT_DISABLED: "1",
    }).RATE_LIMIT_DISABLED,
    false,
  );
});

const prod = { ...base, NODE_ENV: "production", JWT_SECRET: "x".repeat(32), CORS_ORIGINS: "https://a.com" };

test("produção: sem COMPANY_CNPJ não sobe", () => {
  assert.throws(() => loadEnv(prod), /COMPANY_CNPJ/);
});

test("COMPANY_CNPJ inválido não sobe (em qualquer ambiente)", () => {
  assert.throws(() => loadEnv({ ...prod, COMPANY_CNPJ: "11444777000160" }), /COMPANY_CNPJ/);
  assert.throws(() => loadEnv({ ...base, COMPANY_CNPJ: "123" }), /COMPANY_CNPJ/);
});

test("COMPANY_CNPJ é opcional fora de produção e aceita CNPJ alfanumérico", () => {
  assert.equal(loadEnv(base).COMPANY_CNPJ, undefined);
  assert.equal(loadEnv({ ...base, COMPANY_CNPJ: "12abc34501de35" }).COMPANY_CNPJ, "12ABC34501DE35");
});
