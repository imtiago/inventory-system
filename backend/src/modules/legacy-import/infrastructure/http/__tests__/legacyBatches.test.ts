import "dotenv/config";
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { prisma } from "@shared/prisma";
import { app } from "../../../../../app";
import { createTestUser, type TestUser } from "../../../../../test/authFixtures";
import { keyShape } from "../../../../../test/keyShape";
import { BOUNDARY, multipart } from "../../../../nfe-import/infrastructure/http/__tests__/nfeTestNotes";

app.log.level = "silent";

const FIXTURES_DIR = new URL("../../../../../../../frontend/src/test/fixtures/legacy-import/", import.meta.url);
const loadFixture = (name: string): unknown => JSON.parse(readFileSync(new URL(`${name}.json`, FIXTURES_DIR), "utf8"));

/** Palavra aleatória só de letras (nomes de teste não colidem com clientes reais nem de outros arquivos). */
const word = () =>
  Array.from(randomBytes(8))
    .map((b) => String.fromCharCode(97 + (b % 26)))
    .join("");
const cap = (w: string) => w[0].toUpperCase() + w.slice(1);

const HEADER = "nome;celular;data_compra;descricao;valor_total;valor_pago;vencimentos;perfil;observacao";

describe("Lotes de importação do caderninho (/legacy-imports)", () => {
  let admin: TestUser;
  let vendedor: TestUser;
  const batchIds: string[] = [];
  const customerIds: string[] = [];

  before(async () => {
    admin = await createTestUser({ role: "ADMIN" });
    vendedor = await createTestUser({ role: "VENDEDOR" });
  });

  after(async () => {
    await prisma.legacyImportBatch.deleteMany({ where: { id: { in: batchIds } } });
    await prisma.customer.deleteMany({ where: { id: { in: customerIds } } });
    await admin.cleanup();
    await vendedor.cleanup();
    await app.close();
    await prisma.$disconnect();
  });

  const call = (method: "GET" | "POST" | "PATCH" | "DELETE", url: string, payload?: object, user = admin) =>
    app.inject({ method, url, headers: { authorization: `Bearer ${user.token}` }, payload });

  const upload = async (csv: string | Buffer, user = admin, filename = "caderno.csv") => {
    const res = await app.inject({
      method: "POST",
      url: "/legacy-imports/csv",
      headers: { authorization: `Bearer ${user.token}`, "content-type": `multipart/form-data; boundary=${BOUNDARY}` },
      payload: multipart([{ name: "file", filename, contentType: "text/csv", content: csv }]),
    });
    if (res.statusCode === 201) batchIds.push(res.json().data.id);
    return res;
  };

  const createCustomer = async (name: string, phone: string | null = null) => {
    const c = await prisma.customer.create({ data: { name, code: `tx-test-${randomUUID()}`, phone } });
    customerIds.push(c.id);
    return c;
  };

  const manualBatch = async () => {
    const res = await call("POST", "/legacy-imports", { source: "MANUAL" });
    assert.equal(res.statusCode, 201, res.body);
    batchIds.push(res.json().data.id);
    return res.json().data as { id: string };
  };

  test("upload do modelo preenchido com 3 linhas → DRAFT; resumo: 2 novos, 1 existente, total em aberto", async () => {
    const existing = await createCustomer(`${cap(word())} ${cap(word())}`);
    const csv = [
      HEADER,
      `${existing.name};;05/03/2026;Sofá;1.000,00;200,00;;;`,
      `${cap(word())} ${cap(word())};11988887777;;Fogão;300,00;;;Bom;`,
      `${cap(word())} ${cap(word())};;;Geladeira;50,50;;;;obs`,
    ].join("\r\n");
    const res = await upload(csv);
    assert.equal(res.statusCode, 201, res.body);
    const batch = res.json().data;
    assert.equal(batch.status, "DRAFT");
    assert.equal(batch.source, "CSV");
    assert.equal(batch.fileName, "caderno.csv");
    assert.equal(batch.rows.length, 3);
    assert.deepEqual(batch.summary, {
      newCustomers: 2,
      existingCustomers: 1,
      openTotal: 800 + 300 + 50.5,
      rows: 3,
      warnings: 3,
      errors: 0,
      ignored: 0,
    });
    const first = batch.rows[0];
    assert.equal(first.customerAction.kind, "LINK");
    assert.equal(first.customerAction.customerId, existing.id);
    assert.equal(first.data.total, 1000);
    assert.equal(first.data.open, 800);
    assert.equal(first.line, 2);
    assert.deepEqual(keyShape(res.json()), keyShape(loadFixture("legacyBatch")));

    const again = await call("GET", `/legacy-imports/${batch.id}`);
    assert.equal(again.statusCode, 200);
    assert.deepEqual(again.json().data.summary, batch.summary);
  });

  test("linha com nome parecido a cliente existente → WARNING SIMILAR_CUSTOMER com sugestão; duas linhas da mesma pessoa → SIMILAR_ROW", async () => {
    const [a, b, c] = [cap(word()), cap(word()), cap(word())];
    const existing = await createCustomer(`${a} ${b} ${c}`);
    const d = cap(word());
    const csv = [
      HEADER,
      `${a} ${b[0]}. ${c};;01/02/2026;x;100,00;;;;`,
      `${d} Souza;;01/02/2026;y;10,00;;;;`,
      `${d} S.;;01/02/2026;z;20,00;;;;`,
    ].join("\n");
    const res = await upload(csv);
    assert.equal(res.statusCode, 201, res.body);
    const [r1, r2, r3] = res.json().data.rows;
    assert.equal(r1.status, "WARNING");
    assert.ok(r1.issues.some((i: { code: string; severity: string }) => i.code === "SIMILAR_CUSTOMER" && i.severity === "WARNING"));
    assert.deepEqual(
      r1.suggestions.map((s: { customerId: string; match: string; name: string }) => [s.customerId, s.match, s.name]),
      [[existing.id, "SIMILAR", existing.name]],
    );
    assert.equal(r1.customerAction.kind, "NEW");
    assert.ok(!r2.issues.some((i: { code: string }) => i.code === "SIMILAR_ROW"));
    assert.ok(r3.issues.some((i: { code: string }) => i.code === "SIMILAR_ROW"));
    assert.equal(r3.suggestions[0].rowId, r2.id);

    // Decisão: juntar a 3ª linha na 2ª tira o aviso; a 1ª fica como novo confirmado.
    const batchId = res.json().data.id;
    const merged = await call("PATCH", `/legacy-imports/${batchId}/rows/${r3.id}`, {
      customerAction: { kind: "SAME_AS_ROW", rowId: r2.id },
    });
    assert.equal(merged.statusCode, 200, merged.body);
    const rows = merged.json().data.rows;
    assert.ok(!rows[2].issues.some((i: { code: string }) => i.code === "SIMILAR_ROW"));
    assert.deepEqual(rows[2].customerAction, { kind: "SAME_AS_ROW", rowId: r2.id });
    assert.equal(merged.json().data.summary.newCustomers, 2);

    const linked = await call("PATCH", `/legacy-imports/${batchId}/rows/${r1.id}`, {
      customerAction: { kind: "LINK", customerId: existing.id },
    });
    assert.equal(linked.statusCode, 200, linked.body);
    assert.ok(!linked.json().data.rows[0].issues.some((i: { code: string }) => i.code === "SIMILAR_CUSTOMER"));
    assert.equal(linked.json().data.summary.existingCustomers, 1);
  });

  test("PATCH corrige 'valor_pago' e a linha sai de ERROR para OK; resumo recalculado", async () => {
    const csv = [HEADER, `${cap(word())} ${cap(word())};11977776666;01/02/2026;x;100,00;150,00;;;`].join("\n");
    const res = await upload(csv);
    const batch = res.json().data;
    assert.equal(batch.rows[0].status, "ERROR");
    assert.equal(batch.summary.errors, 1);
    assert.equal(batch.summary.openTotal, 0);

    const fixed = await call("PATCH", `/legacy-imports/${batch.id}/rows/${batch.rows[0].id}`, { data: { paid: 40 } });
    assert.equal(fixed.statusCode, 200, fixed.body);
    const row = fixed.json().data.rows[0];
    assert.equal(row.status, "OK");
    assert.deepEqual(row.issues, []);
    assert.equal(row.data.paid, 40);
    assert.equal(row.data.open, 60);
    assert.equal(fixed.json().data.summary.errors, 0);
    assert.equal(fixed.json().data.summary.openTotal, 60);

    const ignored = await call("PATCH", `/legacy-imports/${batch.id}/rows/${row.id}`, { ignored: true });
    assert.equal(ignored.json().data.rows[0].status, "IGNORED");
    assert.equal(ignored.json().data.summary.ignored, 1);
    assert.equal(ignored.json().data.summary.openTotal, 0);
    const back = await call("PATCH", `/legacy-imports/${batch.id}/rows/${row.id}`, { ignored: false });
    assert.equal(back.json().data.rows[0].status, "OK");
  });

  test("PATCH customerAction LINK para cliente inexistente → 404 CUSTOMER_NOT_FOUND", async () => {
    const res = await upload([HEADER, `${cap(word())} ${cap(word())};;;x;10,00;;;;`].join("\n"));
    const batch = res.json().data;
    const bad = await call("PATCH", `/legacy-imports/${batch.id}/rows/${batch.rows[0].id}`, {
      customerAction: { kind: "LINK", customerId: randomUUID() },
    });
    assert.equal(bad.statusCode, 404);
    assert.equal(bad.json().code, "CUSTOMER_NOT_FOUND");
  });

  test("lançamento rápido: cliente novo com 2 dívidas → 2 linhas no lote MANUAL; cliente existente vira LINK", async () => {
    const batch = await manualBatch();
    assert.equal((batch as { source?: string }).source, "MANUAL");
    const name = `${cap(word())} ${cap(word())}`;
    const res = await call("POST", `/legacy-imports/${batch.id}/rows`, {
      customer: { name, phone: "(11) 98888-7777" },
      debts: [
        { amount: 120.5, paid: 20.5, purchaseDate: "2026-02-10", description: "Sofá" },
        { amount: 80, dueDates: [{ date: "2026-12-10", amount: 80 }], notes: "combinado" },
      ],
    });
    assert.equal(res.statusCode, 201, res.body);
    const data = res.json().data;
    assert.equal(data.rows.length, 2);
    assert.equal(data.rows[0].data.name, name);
    assert.equal(data.rows[0].data.phone, "11988887777");
    assert.equal(data.rows[0].data.open, 100);
    assert.equal(data.rows[0].data.purchaseDate, "2026-02-10");
    assert.deepEqual(data.rows[1].data.dueDates, [{ date: "2026-12-10", amount: 80 }]);
    assert.equal(data.rows[1].customerAction.kind, "SAME_AS_ROW");
    assert.equal(data.rows[1].customerAction.rowId, data.rows[0].id);
    assert.ok(!data.rows[1].issues.some((i: { code: string }) => i.code === "SIMILAR_ROW"));
    assert.equal(data.summary.newCustomers, 1);
    assert.equal(data.summary.openTotal, 180);

    const existing = await createCustomer(`${cap(word())} ${cap(word())}`);
    const more = await call("POST", `/legacy-imports/${batch.id}/rows`, {
      customer: { existingId: existing.id },
      debts: [{ amount: 30, purchaseDate: "2026-01-01" }],
    });
    assert.equal(more.statusCode, 201, more.body);
    const last = more.json().data.rows[2];
    assert.equal(last.data.name, existing.name);
    assert.deepEqual(last.customerAction, { kind: "LINK", customerId: existing.id });
    assert.equal(more.json().data.summary.existingCustomers, 1);

    const missing = await call("POST", `/legacy-imports/${batch.id}/rows`, {
      customer: { existingId: randomUUID() },
      debts: [{ amount: 30 }],
    });
    assert.equal(missing.statusCode, 404);
    assert.equal(missing.json().code, "CUSTOMER_NOT_FOUND");
  });

  test("arquivo sem coluna nome → 400; arquivo > 1 MB → 400; sem arquivo → 400", async () => {
    const noName = await upload("celular;valor_total\r\n11988887777;10,00\r\n");
    assert.equal(noName.statusCode, 400);
    assert.equal(noName.json().message, "Coluna obrigatória ausente: nome");

    const big = await upload(`${HEADER}\r\n${"x".repeat(1_100_000)}\r\n`);
    assert.equal(big.statusCode, 400);
    assert.equal(big.json().code, "FILE_TOO_LARGE");

    const empty = await upload(`${HEADER}\r\n`);
    assert.equal(empty.statusCode, 400);

    const none = await app.inject({
      method: "POST",
      url: "/legacy-imports/csv",
      headers: { authorization: `Bearer ${admin.token}` },
    });
    assert.equal(none.statusCode, 400);
  });

  test("windows-1252 e modelo: acentos íntegros", async () => {
    const name = `João ${cap(word())}`;
    const bytes = Buffer.concat([Buffer.from(`${HEADER}\r\n`), Buffer.from(`${name};;;x;R$ 1.234,56;;;;\r\n`, "latin1")]);
    const res = await upload(bytes);
    assert.equal(res.statusCode, 201, res.body);
    assert.equal(res.json().data.rows[0].data.name, name);
    assert.equal(res.json().data.rows[0].data.total, 1234.56);
    const tpl = await call("GET", "/legacy-imports/template.csv");
    assert.equal(tpl.statusCode, 200);
    assert.match(String(tpl.headers["content-type"]), /text\/csv/);
    assert.match(String(tpl.headers["content-disposition"]), /modelo-caderninho-\d{4}-\d{2}-\d{2}\.csv/);
    assert.ok(tpl.body.startsWith("﻿nome;"));
  });

  test("lista paginada e exclusão só de rascunho", async () => {
    const res = await upload([HEADER, `${cap(word())} ${cap(word())};;;x;10,00;;;;`].join("\n"));
    const id = res.json().data.id;
    const list = await call("GET", "/legacy-imports?page=1&limit=100");
    assert.equal(list.statusCode, 200);
    const item = list.json().data.find((b: { id: string }) => b.id === id);
    assert.ok(item);
    assert.equal(item.summary.rows, 1);
    assert.equal(item.rows, undefined);
    assert.deepEqual(keyShape(list.json()), keyShape(loadFixture("legacyBatches")));

    assert.equal((await call("DELETE", `/legacy-imports/${id}`)).statusCode, 204);
    assert.equal((await call("GET", `/legacy-imports/${id}`)).statusCode, 404);

    const other = await upload([HEADER, `${cap(word())} ${cap(word())};;;x;10,00;;;;`].join("\n"));
    const otherId = other.json().data.id;
    await prisma.legacyImportBatch.update({ where: { id: otherId }, data: { status: "CONFIRMED" } });
    const del = await call("DELETE", `/legacy-imports/${otherId}`);
    assert.equal(del.statusCode, 409);
    assert.equal(del.json().code, "LEGACY_BATCH_NOT_DRAFT");
    const add = await call("POST", `/legacy-imports/${otherId}/rows`, {
      customer: { name: "Fulano de Tal" },
      debts: [{ amount: 1 }],
    });
    assert.equal(add.statusCode, 409);
    assert.equal(add.json().code, "LEGACY_BATCH_NOT_DRAFT");
    const patch = await call("PATCH", `/legacy-imports/${otherId}/rows/${other.json().data.rows[0].id}`, { ignored: true });
    assert.equal(patch.statusCode, 409);
  });

  test("VENDEDOR → 403 em todas as rotas", async () => {
    const res = await upload([HEADER, `${cap(word())} ${cap(word())};;;x;10,00;;;;`].join("\n"));
    const { id, rows } = res.json().data;
    const checks: [string, string, object | undefined][] = [
      ["GET", "/legacy-imports/template.csv", undefined],
      ["GET", "/legacy-imports", undefined],
      ["GET", `/legacy-imports/${id}`, undefined],
      ["POST", "/legacy-imports", { source: "MANUAL" }],
      ["POST", `/legacy-imports/${id}/rows`, { customer: { name: "A B" }, debts: [{ amount: 1 }] }],
      ["PATCH", `/legacy-imports/${id}/rows/${rows[0].id}`, { ignored: true }],
      ["DELETE", `/legacy-imports/${id}`, undefined],
    ];
    for (const [method, url, payload] of checks) {
      const r = await call(method as "GET", url, payload, vendedor);
      assert.equal(r.statusCode, 403, `${method} ${url}`);
    }
    const up = await upload("x", vendedor);
    assert.equal(up.statusCode, 403);
  });
});
