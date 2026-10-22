import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { app } from "../../../app";

const secret = process.env.JWT_SECRET!;

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
  assert.notEqual(res.json().message, "Token ausente.");
});

test("authorize papel ausente → 403 FORBIDDEN", async () => {
  const token = jwt.sign({ sub: "u1", role: "cliente" }, secret);
  const res = await app.inject({
    method: "GET",
    url: "/users",
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.json(), { message: "Acesso negado.", code: "FORBIDDEN" });
});
