import "dotenv/config";
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { prisma } from "@shared/prisma";
import { app } from "../../../../../app";
import { createTestUser, type TestUser } from "../../../../../test/authFixtures";
import { BOUNDARY, multipart } from "../../../../nfe-import/infrastructure/http/__tests__/nfeTestNotes";
import { PrismaLegacyCustomerLookup } from "../../prisma/PrismaLegacyCustomerLookup";

app.log.level = "silent";

const word = () =>
  Array.from(randomBytes(8))
    .map((b) => String.fromCharCode(97 + (b % 26)))
    .join("");
const cap = (w: string) => w[0].toUpperCase() + w.slice(1);
const newName = () => `${cap(word())} ${cap(word())}`;

const HEADER = "nome;celular;data_compra;descricao;valor_total;valor_pago;vencimentos;perfil;observacao";

type Issue = { code: string; severity: string; message: string };
type Row = {
  id: string;
  status: string;
  raw: Record<string, string>;
  autoLinked: boolean;
  customerId: string | null;
  customerAction: { kind: string; customerId?: string };
  issues: Issue[];
};

describe("Revisão do caderninho: texto original, vínculo automático, cliente apagado e busca sem acento", () => {
  let admin: TestUser;
  const batchIds: string[] = [];
  const customerIds: string[] = [];

  before(async () => {
    admin = await createTestUser({ role: "ADMIN" });
  });

  after(async () => {
    await prisma.legacyImportBatch.deleteMany({ where: { id: { in: batchIds } } });
    await prisma.customer.deleteMany({ where: { id: { in: customerIds } } });
    await admin.cleanup();
    await app.close();
    await prisma.$disconnect();
  });

  const call = (method: "GET" | "POST" | "PATCH", url: string, payload?: object) =>
    app.inject({ method, url, headers: { authorization: `Bearer ${admin.token}` }, payload });

  const upload = async (lines: string[]) => {
    const res = await app.inject({
      method: "POST",
      url: "/legacy-imports/csv",
      headers: { authorization: `Bearer ${admin.token}`, "content-type": `multipart/form-data; boundary=${BOUNDARY}` },
      payload: multipart([{ name: "file", filename: "caderno.csv", contentType: "text/csv", content: [HEADER, ...lines].join("\n") }]),
    });
    assert.equal(res.statusCode, 201, res.body);
    batchIds.push(res.json().data.id);
    return res.json().data as { id: string; rows: Row[] };
  };

  const createCustomer = async (name: string) => {
    const c = await prisma.customer.create({ data: { name, code: `tx-test-${randomUUID()}` } });
    customerIds.push(c.id);
    return c;
  };

  test("a linha traz o texto original das colunas (valores inválidos aparecem como foram digitados)", async () => {
    const name = newName();
    const batch = await upload([`${name};123;31/02/2026;Sofá;12,5O;abc;10/12/2026=x;Ótimo;anotado`]);
    const row = batch.rows[0];
    assert.equal(row.status, "ERROR");
    assert.deepEqual(row.raw, {
      nome: name,
      celular: "123",
      data_compra: "31/02/2026",
      descricao: "Sofá",
      valor_total: "12,5O",
      valor_pago: "abc",
      vencimentos: "10/12/2026=x",
      perfil: "Ótimo",
      observacao: "anotado",
    });

    const fixed = await call("PATCH", `/legacy-imports/${batch.id}/rows/${row.id}`, { data: { total: 12.5 } });
    assert.equal(fixed.statusCode, 200, fixed.body);
    const after = fixed.json().data.rows[0] as Row;
    assert.equal(after.raw.valor_total, "12,50");
    assert.equal(after.raw.valor_pago, "abc");

    const again = await call("GET", `/legacy-imports/${batch.id}`);
    assert.equal((again.json().data.rows[0] as Row).raw.valor_total, "12,50");
  });

  test("autoLinked: só o vínculo automático por nome igual; escolha da usuária e lançamento rápido não", async () => {
    const existing = await createCustomer(newName());
    const batch = await upload([`${existing.name};;;x;10,00;;;;`, `${newName()};;;y;20,00;;;;`]);
    const [linked, fresh] = batch.rows;
    assert.equal(linked.customerAction.kind, "LINK");
    assert.equal(linked.autoLinked, true);
    assert.equal(fresh.autoLinked, false);
    assert.deepEqual(Object.keys(linked.customerAction).sort(), ["customerId", "kind"]);

    // Revisões seguintes mantêm a marca.
    const get = await call("GET", `/legacy-imports/${batch.id}`);
    assert.equal((get.json().data.rows[0] as Row).autoLinked, true);
    const touched = await call("PATCH", `/legacy-imports/${batch.id}/rows/${fresh.id}`, { data: { notes: "x" } });
    assert.equal((touched.json().data.rows[0] as Row).autoLinked, true);

    // Escolha explícita (mesmo cliente) deixa de ser automática.
    const chosen = await call("PATCH", `/legacy-imports/${batch.id}/rows/${linked.id}`, {
      customerAction: { kind: "LINK", customerId: existing.id },
    });
    assert.equal(chosen.statusCode, 200, chosen.body);
    assert.equal((chosen.json().data.rows[0] as Row).autoLinked, false);

    const manual = await call("POST", "/legacy-imports", { source: "MANUAL" });
    batchIds.push(manual.json().data.id);
    const quick = await call("POST", `/legacy-imports/${manual.json().data.id}/rows`, {
      customer: { existingId: existing.id },
      debts: [{ amount: 5 }],
    });
    assert.equal(quick.statusCode, 201, quick.body);
    assert.equal((quick.json().data.rows[0] as Row).autoLinked, false);
  });

  test("cliente vinculado apagado: a revisão marca ERROR LINKED_CUSTOMER_MISSING; editar não dá 409; 'criar novo' resolve", async () => {
    const customer = await createCustomer(newName());
    const manual = await call("POST", "/legacy-imports", { source: "MANUAL" });
    const batchId = manual.json().data.id as string;
    batchIds.push(batchId);
    const added = await call("POST", `/legacy-imports/${batchId}/rows`, {
      customer: { existingId: customer.id },
      debts: [{ amount: 50, purchaseDate: "2026-01-10" }],
    });
    assert.equal(added.statusCode, 201, added.body);
    const rowId = (added.json().data.rows[0] as Row).id;

    await prisma.customer.delete({ where: { id: customer.id } });

    const get = await call("GET", `/legacy-imports/${batchId}`);
    const row = get.json().data.rows[0] as Row;
    assert.equal(row.status, "ERROR");
    const issue = row.issues.find((i) => i.code === "LINKED_CUSTOMER_MISSING");
    assert.ok(issue, JSON.stringify(row.issues));
    assert.equal(issue.severity, "ERROR");
    assert.match(issue.message, /não existe mais/);
    assert.match(issue.message, /Criar novo/);
    assert.equal(row.customerId, null);
    assert.equal(get.json().data.summary.errors, 1);

    const edited = await call("PATCH", `/legacy-imports/${batchId}/rows/${rowId}`, { data: { notes: "conferido" } });
    assert.equal(edited.statusCode, 200, edited.body);
    assert.equal((edited.json().data.rows[0] as Row).status, "ERROR");

    const ignored = await call("PATCH", `/legacy-imports/${batchId}/rows/${rowId}`, { ignored: true });
    assert.equal(ignored.statusCode, 200, ignored.body);
    const restored = await call("PATCH", `/legacy-imports/${batchId}/rows/${rowId}`, { ignored: false });
    assert.equal(restored.statusCode, 200, restored.body);

    const created = await call("PATCH", `/legacy-imports/${batchId}/rows/${rowId}`, { customerAction: { kind: "NEW" } });
    assert.equal(created.statusCode, 200, created.body);
    const now = created.json().data.rows[0] as Row;
    assert.notEqual(now.status, "ERROR");
    assert.equal(now.customerAction.kind, "NEW");
    assert.ok(!now.issues.some((i) => i.code === "LINKED_CUSTOMER_MISSING"));
  });

  test("busca de candidatos em loja grande ignora acento ('Jose' encontra 'José')", async () => {
    const [w1, w2] = [word(), word()];
    const accented = await createCustomer(`Jôsé${w1} ${cap(w2)}`);
    const upper = await createCustomer(`ÉLÇIO${w2} ${cap(w1)}`);
    const lookup = new PrismaLegacyCustomerLookup(0);
    const found = await lookup.candidates([`Jose${w1} ${w2}`, `elcio${w2}`]);
    const ids = found.map((c) => c.id);
    assert.ok(ids.includes(accented.id), "José sem acento");
    assert.ok(ids.includes(upper.id), "maiúsculas acentuadas");
    assert.ok(found.length < 50, `só os que dividem o termo (veio ${found.length})`);
  });
});
