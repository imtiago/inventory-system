import "dotenv/config";
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import { prisma } from "@shared/prisma";
import { app } from "../../../app";
import { getTestUserId } from "../../../test/inventoryFixtures";

app.log.level = "silent";

const boundary = "----tx-test-boundary-final";

describe("Correções finais da revisão (HTTP)", () => {
  let token: string;
  before(async () => {
    token = jwt.sign({ sub: await getTestUserId(), role: "admin" }, process.env.JWT_SECRET!);
  });
  after(async () => {
    await app.close();
    await prisma.$disconnect();
  });
  const auth = () => ({ authorization: `Bearer ${token}` });

  test("POST /customers sem email → mensagem de validação em português", async () => {
    const res = await app.inject({ method: "POST", url: "/customers", headers: auth(), payload: { name: "tx-test-x" } });
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

  test("POST /nfe-import XML bem formado (UPDATE_ONLY) → 200", async () => {
    const xml =
      `<nfe><products><product><code>tx-test-${randomUUID()}</code><name>x</name>` +
      `<quantity>1</quantity><unit>UN</unit><price>1.5</price></product></products></nfe>`;
    const res = await app.inject({
      method: "POST",
      url: "/nfe-import?mode=UPDATE_ONLY",
      headers: { ...auth(), "content-type": `multipart/form-data; boundary=${boundary}` },
      payload:
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="nota.xml"\r\nContent-Type: text/xml\r\n\r\n${xml}\r\n--${boundary}--\r\n`,
    });
    assert.equal(res.statusCode, 200, res.body);
    assert.equal(res.json().imported, 1);
  });

  test("token sem role em rota com authorize → 401 Token inválido", async () => {
    const t = jwt.sign({ sub: await getTestUserId() }, process.env.JWT_SECRET!);
    const res = await app.inject({ method: "GET", url: "/users", headers: { authorization: `Bearer ${t}` } });
    assert.equal(res.statusCode, 401, res.body);
    assert.deepEqual(res.json(), { message: "Token inválido.", code: "UNAUTHENTICATED" });
  });

  test("token com payload string → 401 Token inválido", async () => {
    const t = jwt.sign("apenas-texto", process.env.JWT_SECRET!);
    const res = await app.inject({ method: "GET", url: "/users", headers: { authorization: `Bearer ${t}` } });
    assert.equal(res.statusCode, 401, res.body);
    assert.equal(res.json().code, "UNAUTHENTICATED");
  });

  test("GET /users/me com usuário removido → 404 USER_NOT_FOUND", async () => {
    const t = jwt.sign({ sub: randomUUID(), role: "admin" }, process.env.JWT_SECRET!);
    const res = await app.inject({ method: "GET", url: "/users/me", headers: { authorization: `Bearer ${t}` } });
    assert.equal(res.statusCode, 404, res.body);
    assert.equal(res.json().code, "USER_NOT_FOUND");
  });
});
