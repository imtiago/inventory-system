import "dotenv/config";
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "@shared/prisma";
import { app } from "../../../../../app";
import { createTestUser, TestUser } from "../../../../../test/authFixtures";
import { randomAlphanumericCnpj, randomCnpj, randomCpf } from "../../../../../test/documentFixtures";

app.log.level = "silent";

const EXISTS = { message: "Já existe cliente com este CPF/CNPJ.", code: "CUSTOMER_DOCUMENT_EXISTS" };
const maskCpf = (d: string) => `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;

describe("Clientes: CPF/CNPJ (document)", () => {
  let user: TestUser;
  const createdIds: string[] = [];
  const name = () => `tx-test-${randomUUID()}`;

  const call = (method: "GET" | "POST" | "PATCH", url: string, payload?: object) =>
    app.inject({ method, url, headers: { authorization: `Bearer ${user.token}` }, payload });

  const create = async (payload: object) => {
    const res = await call("POST", "/customers", payload);
    const id = res.json()?.data?.id;
    if (id) createdIds.push(id);
    return res;
  };

  before(async () => {
    user = await createTestUser({ role: "VENDEDOR" });
  });

  after(async () => {
    await prisma.customer.deleteMany({ where: { id: { in: createdIds } } });
    await user.cleanup();
    await app.close();
    await prisma.$disconnect();
  });

  test("POST com CPF mascarado grava só os dígitos; CNPJ numérico e alfanumérico aceitos", async () => {
    const cpf = randomCpf();
    const res = await create({ name: name(), document: maskCpf(cpf) });
    assert.equal(res.statusCode, 201, res.body);
    assert.equal(res.json().data.document, cpf);

    const cnpj = randomCnpj();
    assert.equal((await create({ name: name(), document: cnpj })).json().data.document, cnpj);
    const alnum = randomAlphanumericCnpj();
    const r3 = await create({ name: name(), document: alnum.toLowerCase() });
    assert.equal(r3.statusCode, 201, r3.body);
    assert.equal(r3.json().data.document, alnum);
  });

  test("sem documento (ou em branco) → document null; vários clientes sem documento convivem", async () => {
    const a = await create({ name: name() });
    const b = await create({ name: name(), document: "   " });
    const c = await create({ name: name(), document: null });
    for (const r of [a, b, c]) {
      assert.equal(r.statusCode, 201, r.body);
      assert.equal(r.json().data.document, null);
    }
  });

  test("documento inválido → 400 no campo document", async () => {
    for (const document of ["123", "111.111.111-11", "529.982.247-26", "abc"]) {
      const res = await create({ name: name(), document });
      assert.equal(res.statusCode, 400, `${document}: ${res.body}`);
      assert.equal(res.json().code, "VALIDATION_ERROR");
      assert.ok(res.json().errors.some((e: { field: string }) => e.field === "document"), document);
    }
  });

  test("duplicado (inclusive com outra máscara) → 409 CUSTOMER_DOCUMENT_EXISTS", async () => {
    const cpf = randomCpf();
    assert.equal((await create({ name: name(), document: cpf })).statusCode, 201);
    const dup = await create({ name: name(), document: maskCpf(cpf) });
    assert.equal(dup.statusCode, 409, dup.body);
    assert.deepEqual(dup.json(), EXISTS);
  });

  test("corrida: dois POST simultâneos com o mesmo documento → um 201 e um 409", async () => {
    const cpf = randomCpf();
    const [x, y] = await Promise.all([create({ name: name(), document: cpf }), create({ name: name(), document: cpf })]);
    assert.deepEqual([x.statusCode, y.statusCode].sort(), [201, 409]);
    const lost = x.statusCode === 409 ? x : y;
    assert.deepEqual(lost.json(), EXISTS);
  });

  test("PATCH: define, repete o próprio, recusa o de outro e limpa com null/branco", async () => {
    const mine = randomCpf();
    const other = randomCpf();
    await create({ name: name(), document: other });
    const c = await create({ name: name() });
    const id = c.json().data.id;

    const set = await call("PATCH", `/customers/${id}`, { document: maskCpf(mine) });
    assert.equal(set.statusCode, 200, set.body);
    assert.equal(set.json().data.document, mine);

    const same = await call("PATCH", `/customers/${id}`, { document: mine, name: name() });
    assert.equal(same.statusCode, 200, same.body);

    const dup = await call("PATCH", `/customers/${id}`, { document: other });
    assert.equal(dup.statusCode, 409, dup.body);
    assert.deepEqual(dup.json(), EXISTS);

    const bad = await call("PATCH", `/customers/${id}`, { document: "123" });
    assert.equal(bad.statusCode, 400);

    const clear = await call("PATCH", `/customers/${id}`, { document: "" });
    assert.equal(clear.statusCode, 200, clear.body);
    assert.equal(clear.json().data.document, null);
    // PATCH sem a chave não mexe no documento.
    await call("PATCH", `/customers/${id}`, { document: mine });
    const keep = await call("PATCH", `/customers/${id}`, { name: name() });
    assert.equal(keep.json().data.document, mine);
  });

  test("GET /customers?search=<documento> encontra por dígitos, com ou sem máscara", async () => {
    const cpf = randomCpf();
    const res = await create({ name: name(), document: cpf });
    const id = res.json().data.id;
    for (const search of [cpf, maskCpf(cpf), cpf.slice(0, 6)]) {
      const list = await call("GET", `/customers?limit=100&search=${encodeURIComponent(search)}`);
      assert.equal(list.statusCode, 200, list.body);
      assert.ok(list.json().data.some((c: { id: string }) => c.id === id), search);
    }
    assert.equal((await call("GET", `/customers/${id}`)).json().data.document, cpf);
  });
});
