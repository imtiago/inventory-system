import "dotenv/config";
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { prisma } from "@shared/prisma";
import { app } from "../../../../../app";
import { keyShape } from "../../../../../test/keyShape";
import { createTestUser, TestUser } from "../../../../../test/authFixtures";

app.log.level = "silent";

const FIXTURES_DIR = new URL("../../../../../../../frontend/src/test/fixtures/customers/", import.meta.url);
const loadFixture = (name: string): unknown =>
  JSON.parse(readFileSync(new URL(`${name}.json`, FIXTURES_DIR), "utf8"));

const CUSTOMER_KEYS = ["address", "code", "createdAt", "email", "id", "name", "phone"];

describe("Clientes (/customers)", () => {
  let admin: TestUser;
  let vendedor: TestUser;
  let estoquista: TestUser;
  const createdIds: string[] = [];
  const tag = () => `tx-test-${randomUUID()}`;

  const call = (method: "GET" | "POST" | "PUT" | "PATCH", url: string, user: TestUser, payload?: object) =>
    app.inject({ method, url, headers: { authorization: `Bearer ${user.token}` }, payload });

  const create = async (payload: object, user = vendedor) => {
    const res = await call("POST", "/customers", user, payload);
    const id = res.json()?.data?.id ?? res.json()?.id;
    if (id) createdIds.push(id);
    return res;
  };

  before(async () => {
    admin = await createTestUser({ role: "ADMIN" });
    vendedor = await createTestUser({ role: "VENDEDOR" });
    estoquista = await createTestUser({ role: "ESTOQUISTA" });
  });

  after(async () => {
    await prisma.customer.deleteMany({ where: { id: { in: createdIds } } });
    await admin.cleanup();
    await vendedor.cleanup();
    await estoquista.cleanup();
    await app.close();
    await prisma.$disconnect();
  });

  test("POST só com name → 201 { data } com code; 'Ana  McDonald' preserva maiúsculas e colapsa espaços", async () => {
    const t = tag();
    const res = await create({ name: `  ${t}  Ana  McDonald ` });
    assert.equal(res.statusCode, 201);
    const { data } = res.json();
    assert.equal(data.name, `${t} Ana McDonald`);
    assert.match(data.code, /^C\d+$/);
    assert.equal(data.email, null);
    assert.equal(data.phone, null);
    assert.equal(data.address, null);
    assert.deepEqual(Object.keys(data).sort(), CUSTOMER_KEYS);
    assert.deepEqual(keyShape(res.json()), keyShape(loadFixture("customer")));

    const got = await call("GET", `/customers/${data.id}`, vendedor);
    assert.equal(got.statusCode, 200);
    assert.deepEqual(got.json(), { data });
  });

  test("opcionais aceitam ausente, null e '' (→ null); e-mail inválido → 400; telefone com 9 dígitos → 400", async () => {
    for (const extra of [{}, { email: null, phone: null, address: null }, { email: "", phone: "", address: "" }]) {
      const res = await create({ name: tag(), ...extra });
      assert.equal(res.statusCode, 201);
      const { data } = res.json();
      assert.equal(data.email, null);
      assert.equal(data.phone, null);
      assert.equal(data.address, null);
    }

    const full = await create({
      name: tag(),
      email: "  Ana@Example.COM ",
      phone: "(11) 98765-4321",
      address: "  Rua A, 1  ",
    });
    assert.equal(full.statusCode, 201);
    assert.equal(full.json().data.email, "ana@example.com");
    assert.equal(full.json().data.phone, "11987654321");
    assert.equal(full.json().data.address, "Rua A, 1");

    assert.equal((await create({ name: tag(), email: "não-é-email" })).statusCode, 400);
    assert.equal((await create({ name: tag(), phone: "119876543" })).statusCode, 400);
    assert.equal((await create({ name: tag(), phone: "119876543210" })).statusCode, 400);
    assert.equal((await create({ name: tag(), address: "x".repeat(201) })).statusCode, 400);
    assert.equal((await create({ name: "a" })).statusCode, 400);
    assert.equal((await create({ name: "x".repeat(121) })).statusCode, 400);
    assert.equal((await create({})).statusCode, 400);
  });

  test("PATCH /customers/:id { phone } altera só o telefone; null limpa; ausente preserva", async () => {
    const created = await create({ name: tag(), email: "p@example.com", phone: "1133334444", address: "Rua B" });
    const { id, name } = created.json().data;

    const res = await call("PATCH", `/customers/${id}`, vendedor, { phone: "11 98888-7777" });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.json().data, { ...created.json().data, phone: "11988887777" });
    assert.equal(res.json().data.name, name);

    const cleared = await call("PATCH", `/customers/${id}`, vendedor, { email: null, address: "" });
    assert.equal(cleared.statusCode, 200);
    assert.equal(cleared.json().data.email, null);
    assert.equal(cleared.json().data.address, null);
    assert.equal(cleared.json().data.phone, "11988887777");
    assert.equal(cleared.json().data.code, created.json().data.code);

    const renamed = await call("PATCH", `/customers/${id}`, vendedor, { name: `${name}   Z` });
    assert.equal(renamed.json().data.name, `${name} Z`);

    assert.equal((await call("PATCH", `/customers/${id}`, vendedor, { email: "ruim" })).statusCode, 400);
  });

  test("PATCH inexistente → 404 CUSTOMER_NOT_FOUND; corpo vazio → 400; PUT → 404 ROUTE_NOT_FOUND", async () => {
    const missing = await call("PATCH", `/customers/${randomUUID()}`, vendedor, { phone: "11988887777" });
    assert.equal(missing.statusCode, 404);
    assert.deepEqual(missing.json(), { message: "Cliente não encontrado.", code: "CUSTOMER_NOT_FOUND" });

    const created = await create({ name: tag() });
    const id = created.json().data.id;
    assert.equal((await call("PATCH", `/customers/${id}`, vendedor, {})).statusCode, 400);
    assert.equal((await call("PATCH", `/customers/${id}`, vendedor, { desconhecido: 1 })).statusCode, 400);
    assert.equal((await call("PATCH", `/customers/not-a-uuid`, vendedor, { phone: "11988887777" })).statusCode, 400);

    const put = await call("PUT", `/customers/${id}`, vendedor, { name: "abc" });
    assert.equal(put.statusCode, 404);
    assert.equal(put.json().code, "ROUTE_NOT_FOUND");
  });

  test("GET /customers?search= encontra por nome, código, e-mail e telefone; chaves = fixtures", async () => {
    const t = tag();
    const digits = String(Math.floor(Math.random() * 1e9)).padStart(9, "0");
    const phone = `11${digits}`;
    const email = `${t}@example.com`;
    const created = await create({ name: `${t} Busca`, email, phone });
    const { id, code } = created.json().data;

    const search = async (s: string) => {
      const res = await call("GET", `/customers?search=${encodeURIComponent(s)}&limit=100`, vendedor);
      assert.equal(res.statusCode, 200);
      return res.json();
    };
    const ids = (body: { data: { id: string }[] }) => body.data.map((c) => c.id);

    assert.deepEqual(ids(await search(t.toUpperCase())), [id]);
    assert.ok(ids(await search(code.toLowerCase())).includes(id));
    assert.deepEqual(ids(await search(`${t}@EXAMPLE`)), [id]);
    assert.ok(ids(await search(digits)).includes(id));
    assert.ok(ids(await search(`(11) ${digits.slice(0, 5)}-${digits.slice(5)}`)).includes(id));
    // menos de 4 dígitos não busca por telefone
    assert.ok(!ids(await search(digits.slice(0, 3))).includes(id) || code.includes(digits.slice(0, 3)));
    // literal: % e _ não são curingas
    assert.deepEqual((await search(`${t}%`)).data, []);

    const body = await search(t);
    assert.deepEqual(keyShape(body), keyShape(loadFixture("customerList")));
    assert.deepEqual(Object.keys(body.data[0]).sort(), CUSTOMER_KEYS);

    assert.equal((await call("GET", "/customers?limit=101", vendedor)).statusCode, 400);
  });

  test("permissões: ESTOQUISTA → 403 em leitura e escrita; ADMIN pode", async () => {
    assert.equal((await call("GET", "/customers", estoquista)).statusCode, 403);
    assert.equal((await call("POST", "/customers", estoquista, { name: tag() })).statusCode, 403);
    assert.equal((await call("PATCH", `/customers/${randomUUID()}`, estoquista, { phone: "1133334444" })).statusCode, 403);
    assert.equal((await create({ name: tag() }, admin)).statusCode, 201);
  });
});
