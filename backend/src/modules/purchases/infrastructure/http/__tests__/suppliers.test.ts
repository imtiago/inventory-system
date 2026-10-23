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

const FIXTURES_DIR = new URL("../../../../../../../frontend/src/test/fixtures/purchases/", import.meta.url);
const loadFixture = (name: string): unknown =>
  JSON.parse(readFileSync(new URL(`${name}.json`, FIXTURES_DIR), "utf8"));

const SUPPLIER_KEYS = ["createdAt", "document", "documentType", "email", "id", "name", "phone"];

// Gera CPF válido a partir de 9 dígitos aleatórios (testes paralelos: documento único por teste).
function cpfDigit(base: number[]): number {
  const factor = base.length + 1;
  const sum = base.reduce((acc, d, i) => acc + d * (factor - i), 0);
  const rest = (sum * 10) % 11;
  return rest === 10 ? 0 : rest;
}
function randomCpf(): string {
  for (;;) {
    const base = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
    if (new Set(base).size === 1) continue;
    const d1 = cpfDigit(base);
    const d2 = cpfDigit([...base, d1]);
    return [...base, d1, d2].join("");
  }
}
function randomCnpj(): string {
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const dv = (nums: number[], w: number[]) => {
    const rest = nums.reduce((acc, d, i) => acc + d * w[i], 0) % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  for (;;) {
    const base = [...Array.from({ length: 8 }, () => Math.floor(Math.random() * 10)), 0, 0, 0, 1];
    if (new Set(base.slice(0, 8)).size === 1) continue;
    const d1 = dv(base, w1);
    const d2 = dv([...base, d1], w2);
    return [...base, d1, d2].join("");
  }
}
const maskCnpj = (d: string) => `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
const maskCpf = (d: string) => `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;

describe("Fornecedores (/suppliers)", () => {
  let admin: TestUser;
  let vendedor: TestUser;
  let estoquista: TestUser;
  const createdIds: string[] = [];
  const purchaseIds: string[] = [];
  const tag = () => `tx-test-${randomUUID()}`;

  const call = (method: "GET" | "POST" | "PATCH" | "DELETE", url: string, user: TestUser, payload?: object) =>
    app.inject({ method, url, headers: { authorization: `Bearer ${user.token}` }, payload });

  const create = async (payload: object, user = admin) => {
    const res = await call("POST", "/suppliers", user, payload);
    const id = res.json()?.data?.id;
    if (id) createdIds.push(id);
    return res;
  };

  before(async () => {
    admin = await createTestUser({ role: "ADMIN" });
    vendedor = await createTestUser({ role: "VENDEDOR" });
    estoquista = await createTestUser({ role: "ESTOQUISTA" });
  });

  after(async () => {
    await prisma.purchase.deleteMany({ where: { id: { in: purchaseIds } } });
    await prisma.supplier.deleteMany({ where: { id: { in: createdIds } } });
    await admin.cleanup();
    await vendedor.cleanup();
    await estoquista.cleanup();
    await app.close();
    await prisma.$disconnect();
  });

  test("POST /suppliers grava documento só com dígitos e documentType; duplicado → 409 SUPPLIER_DOCUMENT_ALREADY_EXISTS", async () => {
    const cpf = randomCpf();
    const res = await create({ name: `  ${tag()}  Acme  Ltda `, document: maskCpf(cpf) });
    assert.equal(res.statusCode, 201);
    const { data } = res.json();
    assert.equal(data.document, cpf);
    assert.equal(data.documentType, "CPF");
    assert.equal(data.email, null);
    assert.equal(data.phone, null);
    assert.match(data.name, /Acme Ltda$/);
    assert.deepEqual(Object.keys(data).sort(), SUPPLIER_KEYS);
    assert.deepEqual(keyShape(res.json()), keyShape(loadFixture("supplier")));

    const row = await prisma.supplier.findUnique({ where: { id: data.id } });
    assert.equal(row?.document, cpf);

    const dup = await create({ name: tag(), document: cpf });
    assert.equal(dup.statusCode, 409);
    assert.equal(dup.json().code, "SUPPLIER_DOCUMENT_ALREADY_EXISTS");
    assert.equal(dup.json().message, "Já existe um fornecedor com esse documento.");

    // mesmo documento com máscara também conflita
    const dupMasked = await create({ name: tag(), document: maskCpf(cpf) });
    assert.equal(dupMasked.statusCode, 409);

    const got = await call("GET", `/suppliers/${data.id}`, estoquista);
    assert.equal(got.statusCode, 200);
    assert.deepEqual(got.json(), { data });
  });

  test("CNPJ válido aceito (documentType CNPJ); opcionais ausente/null/'' → null; e-mail em minúsculas e telefone só dígitos", async () => {
    const cnpj = randomCnpj();
    const res = await create({ name: tag(), document: maskCnpj(cnpj), email: "", phone: null });
    assert.equal(res.statusCode, 201);
    assert.equal(res.json().data.documentType, "CNPJ");
    assert.equal(res.json().data.document, cnpj);
    assert.equal(res.json().data.email, null);
    assert.equal((await prisma.supplier.findUnique({ where: { id: res.json().data.id } }))?.document, cnpj);

    const full = await create({ name: tag(), document: randomCpf(), email: "  Contato@Acme.COM ", phone: "(11) 98765-4321" });
    assert.equal(full.statusCode, 201);
    assert.equal(full.json().data.email, "contato@acme.com");
    assert.equal(full.json().data.phone, "11987654321");
  });

  test("documento inválido → 400 VALIDATION_ERROR com erro em document; nome curto e e-mail inválido → 400", async () => {
    for (const document of ["52998224724", "11111111111", "123", "", "abc"]) {
      const res = await create({ name: tag(), document });
      assert.equal(res.statusCode, 400, document);
      assert.equal(res.json().code, "VALIDATION_ERROR");
      assert.ok(
        JSON.stringify(res.json()).includes("document"),
        `erro deve apontar document: ${JSON.stringify(res.json())}`,
      );
    }
    const missingDoc = await create({ name: tag() });
    assert.equal(missingDoc.statusCode, 400);

    assert.equal((await create({ name: "A", document: randomCpf() })).statusCode, 400);
    assert.equal((await create({ name: tag(), document: randomCpf(), email: "x" })).statusCode, 400);
    assert.equal((await create({ name: tag(), document: randomCpf(), phone: "123" })).statusCode, 400);
  });

  test("PATCH parcial altera só o enviado; DELETE com pedido → 409 SUPPLIER_IN_USE; sem → 204", async () => {
    const cpf = randomCpf();
    const name = tag();
    const created = (await create({ name, document: cpf, email: "a@b.com", phone: "11987654321" })).json().data;

    const res = await call("PATCH", `/suppliers/${created.id}`, admin, { email: null });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.json().data, { ...created, email: null });

    const res2 = await call("PATCH", `/suppliers/${created.id}`, admin, { name: `${name} Novo`, document: randomCpf() });
    assert.equal(res2.statusCode, 200);
    assert.equal(res2.json().data.name, `${name} Novo`);
    assert.equal(res2.json().data.phone, "11987654321");

    assert.equal((await call("PATCH", `/suppliers/${created.id}`, admin, {})).statusCode, 400);
    assert.equal((await call("PATCH", `/suppliers/${randomUUID()}`, admin, { name: "Qualquer" })).statusCode, 404);

    // com pedido de compra → 409
    const purchase = await prisma.purchase.create({
      data: { supplierId: created.id, status: "PENDING", origin: "MANUAL", purchaseDate: new Date() },
    });
    purchaseIds.push(purchase.id);
    const blocked = await call("DELETE", `/suppliers/${created.id}`, admin);
    assert.equal(blocked.statusCode, 409);
    assert.equal(blocked.json().code, "SUPPLIER_IN_USE");
    assert.equal(blocked.json().message, "Fornecedor possui pedidos de compra e não pode ser excluído.");
    assert.ok(await prisma.supplier.findUnique({ where: { id: created.id } }));

    // sem pedido → 204
    const free = (await create({ name: tag(), document: randomCpf() })).json().data;
    const del = await call("DELETE", `/suppliers/${free.id}`, admin);
    assert.equal(del.statusCode, 204);
    assert.equal(await prisma.supplier.findUnique({ where: { id: free.id } }), null);

    const gone = await call("DELETE", `/suppliers/${free.id}`, admin);
    assert.equal(gone.statusCode, 404);
    assert.equal(gone.json().code, "SUPPLIER_NOT_FOUND");
    assert.equal(gone.json().message, "Fornecedor não encontrado.");

    const get404 = await call("GET", `/suppliers/${randomUUID()}`, admin);
    assert.equal(get404.statusCode, 404);
    assert.equal(get404.json().code, "SUPPLIER_NOT_FOUND");
  });

  test("GET /suppliers?search= por nome, documento e e-mail; chaves = fixtures; limit > 100 → 400", async () => {
    const t = tag();
    const cpf = randomCpf();
    const a = (await create({ name: `${t} Alfa`, document: cpf, email: `${t}@Mail.com` })).json().data;
    await create({ name: `${t} Beta`, document: randomCpf() });

    const byName = await call("GET", `/suppliers?search=${t.toUpperCase()}`, estoquista);
    assert.equal(byName.statusCode, 200);
    assert.equal(byName.json().data.length, 2);
    assert.equal(byName.json().pagination.total, 2);
    assert.deepEqual(keyShape(byName.json()), keyShape(loadFixture("supplierList")));

    const byDoc = await call("GET", `/suppliers?search=${encodeURIComponent(maskCpf(cpf))}`, admin);
    assert.deepEqual(byDoc.json().data.map((s: { id: string }) => s.id), [a.id]);
    const byDocDigits = await call("GET", `/suppliers?search=${cpf}`, admin);
    assert.deepEqual(byDocDigits.json().data.map((s: { id: string }) => s.id), [a.id]);

    const byEmail = await call("GET", `/suppliers?search=${encodeURIComponent(`${t}@mail`)}`, admin);
    assert.deepEqual(byEmail.json().data.map((s: { id: string }) => s.id), [a.id]);

    // curingas do LIKE são literais
    const pct = (await create({ name: `${t} 100% Puro`, document: randomCpf() })).json().data;
    const wildcard = await call("GET", `/suppliers?search=${encodeURIComponent("%")}`, admin);
    assert.equal(wildcard.statusCode, 200);
    const ids = wildcard.json().data.map((x: { id: string }) => x.id);
    assert.ok(ids.includes(pct.id));
    assert.ok(!ids.includes(a.id));
    assert.ok(wildcard.json().data.every((x: { name: string; email: string | null }) => `${x.name}${x.email}`.includes("%")));

    assert.equal((await call("GET", "/suppliers?limit=101", admin)).statusCode, 400);
  });

  test("matriz: VENDEDOR → 403 em /suppliers; ESTOQUISTA lê mas não cria (403)", async () => {
    const forbidden = { message: "Acesso negado.", code: "FORBIDDEN" };
    const id = randomUUID();
    for (const [method, url] of [
      ["GET", "/suppliers"],
      ["GET", `/suppliers/${id}`],
      ["POST", "/suppliers"],
      ["PATCH", `/suppliers/${id}`],
      ["DELETE", `/suppliers/${id}`],
    ] as const) {
      const res = await call(method, url, vendedor, {});
      assert.equal(res.statusCode, 403, `VENDEDOR ${method} ${url}`);
      assert.deepEqual(res.json(), forbidden);
    }

    assert.equal((await call("GET", "/suppliers?limit=1", estoquista)).statusCode, 200);
    assert.equal((await call("GET", `/suppliers/${id}`, estoquista)).statusCode, 404);
    for (const [method, url] of [
      ["POST", "/suppliers"],
      ["PATCH", `/suppliers/${id}`],
      ["DELETE", `/suppliers/${id}`],
    ] as const) {
      const res = await call(method, url, estoquista, {});
      assert.equal(res.statusCode, 403, `ESTOQUISTA ${method} ${url}`);
      assert.deepEqual(res.json(), forbidden);
    }
  });
});
