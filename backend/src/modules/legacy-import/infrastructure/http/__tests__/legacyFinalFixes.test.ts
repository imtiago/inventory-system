import "dotenv/config";
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { prisma } from "@shared/prisma";
import { app } from "../../../../../app";
import { createTestUser, type TestUser } from "../../../../../test/authFixtures";
import { newIdempotencyKey } from "../../../../../test/idempotency";
import { acquireCreditTestLock } from "../../../../../test/creditTestLock";
import { resetCreditDefaults } from "../../../../../test/creditFixtures";
import { deleteFinancialDocuments } from "../../../../../test/cleanup";
import { BOUNDARY, multipart } from "../../../../nfe-import/infrastructure/http/__tests__/nfeTestNotes";

app.log.level = "silent";

const word = () =>
  Array.from(randomBytes(8))
    .map((b) => String.fromCharCode(97 + (b % 26)))
    .join("");
const cap = (w: string) => w[0].toUpperCase() + w.slice(1);
// Sem "E"/"De" sozinho no começo (partículas): duas palavras de 8 letras.
const newName = () => `${cap(word())} ${cap(word())}`;

const HEADER = "nome;celular;data_compra;descricao;valor_total;valor_pago;vencimentos;perfil;observacao";

type Issue = { code: string; severity: string; message: string; details?: Record<string, unknown> };
type Row = {
  id: string;
  line: number;
  status: string;
  autoLinked: boolean;
  customerId: string | null;
  linkedCustomerName: string | null;
  acceptDuplicate: boolean;
  customerAction: { kind: string; customerId?: string; confirmedNew?: boolean };
  data: { name: string };
  issues: Issue[];
};
type Batch = { id: string; rows: Row[]; sameFileAs: { id: string; confirmedAt: string } | null };

describe("Caderninho: correções da revisão final (nome × vínculo, dívida repetida, limites de texto, desfazer limite)", () => {
  let admin: TestUser;
  let releaseCreditLock: () => Promise<void>;
  const batchIds: string[] = [];
  const extraCustomerIds: string[] = [];

  before(async () => {
    // Limites dependem dos perfis (globais) e o desfazer restaura limites.
    releaseCreditLock = await acquireCreditTestLock();
    await resetCreditDefaults();
    admin = await createTestUser({ role: "ADMIN" });
  });

  after(async () => {
    try {
      const rows = await prisma.legacyImportRow.findMany({
        where: { batchId: { in: batchIds } },
        select: { id: true, customerId: true },
      });
      const customerIds = [...new Set([...rows.map((r) => r.customerId).filter((x): x is string => !!x), ...extraCustomerIds])];
      await prisma.legacyImportBatch.deleteMany({ where: { id: { in: batchIds } } });
      await deleteFinancialDocuments({ where: { originType: "LEGACY", originId: { in: rows.map((r) => r.id) } } });
      await deleteFinancialDocuments({ where: { partyId: { in: customerIds } } });
      await prisma.creditLimitChange.deleteMany({ where: { customerId: { in: customerIds } } });
      await prisma.customer.deleteMany({ where: { id: { in: customerIds } } });
      await admin.cleanup();
    } finally {
      await releaseCreditLock();
      await app.close();
      await prisma.$disconnect();
    }
  });

  const call = (method: "GET" | "POST" | "PATCH", url: string, payload?: object) =>
    app.inject({
      method,
      url,
      headers: {
        authorization: `Bearer ${admin.token}`,
        ...(method === "POST" ? { "idempotency-key": newIdempotencyKey() } : {}),
      },
      payload,
    });

  const uploadRaw = async (content: string) => {
    const res = await app.inject({
      method: "POST",
      url: "/legacy-imports/csv",
      headers: { authorization: `Bearer ${admin.token}`, "content-type": `multipart/form-data; boundary=${BOUNDARY}` },
      payload: multipart([{ name: "file", filename: "caderno.csv", contentType: "text/csv", content }]),
    });
    if (res.statusCode === 201) batchIds.push(res.json().data.id);
    return res;
  };
  const upload = async (lines: string[]) => {
    const res = await uploadRaw([HEADER, ...lines].join("\n"));
    assert.equal(res.statusCode, 201, res.body);
    return res.json().data as Batch;
  };
  const patch = async (batchId: string, rowId: string, body: object) => {
    const res = await call("PATCH", `/legacy-imports/${batchId}/rows/${rowId}`, body);
    assert.equal(res.statusCode, 200, res.body);
    return res.json().data as Batch;
  };
  const createCustomer = async (name: string, extra: { creditLimit?: number } = {}) => {
    const c = await prisma.customer.create({ data: { name, code: `tx-test-${randomUUID()}`, ...extra } });
    extraCustomerIds.push(c.id);
    return c;
  };
  const confirm = (id: string, body: object = {}) => call("POST", `/legacy-imports/${id}/confirm`, body);
  const revert = (id: string) => call("POST", `/legacy-imports/${id}/revert`, {});

  test("I-4: nome com 121 caracteres (CSV) → linha ERROR NAME_LENGTH; confirmar recusa e nenhum cliente é criado", async () => {
    const longName = `${cap(word())} ${"x".repeat(112)}`;
    assert.equal(longName.length, 121);
    const batch = await upload([`${longName};;;Sofá;100,00;;;;`, `${newName()};;;${"d".repeat(201)};50,00;;;;`]);
    const [first, second] = batch.rows;
    assert.equal(first.status, "ERROR");
    assert.ok(first.issues.some((i) => i.code === "NAME_LENGTH" && i.severity === "ERROR"));
    assert.equal(second.status, "ERROR");
    assert.ok(second.issues.some((i) => i.code === "TEXT_TOO_LONG"));
    const res = await confirm(batch.id);
    assert.equal(res.statusCode, 422, res.body);
    assert.equal(res.json().code, "LEGACY_BATCH_HAS_ERRORS");
    assert.deepEqual(res.json().details.lines, [2, 3]);
    assert.equal(await prisma.customer.count({ where: { name: longName } }), 0);
  });

  test("I-3: lote de no máximo 500 linhas: CSV com 501 → 422 LEGACY_BATCH_TOO_LARGE; lançamento rápido que passaria de 500 → 422", async () => {
    const line = () => `${newName()};;;x;10,00;;;;`;
    const big = await uploadRaw([HEADER, ...Array.from({ length: 501 }, line)].join("\n"));
    assert.equal(big.statusCode, 422, big.body);
    assert.equal(big.json().code, "LEGACY_BATCH_TOO_LARGE");
    assert.match(big.json().message, /500 linhas/);

    const t0 = performance.now();
    const batch = await upload(Array.from({ length: 450 }, line));
    assert.ok(performance.now() - t0 < 8000, "upload de 450 linhas dentro do prazo da transação");
    assert.equal(batch.rows.length, 450);
    const add = await call("POST", `/legacy-imports/${batch.id}/rows`, {
      customer: { name: newName() },
      debts: Array.from({ length: 51 }, () => ({ amount: 10 })),
    });
    assert.equal(add.statusCode, 422, add.body);
    assert.equal(add.json().code, "LEGACY_BATCH_TOO_LARGE");
    const fits = await call("POST", `/legacy-imports/${batch.id}/rows`, {
      customer: { name: newName() },
      debts: Array.from({ length: 50 }, () => ({ amount: 10 })),
    });
    assert.equal(fits.statusCode, 201, fits.body);
    assert.equal(fits.json().data.rows.length, 500);
  });

  test("I-1: editar o nome de linha vinculada automaticamente refaz o vínculo; nome do cliente vinculado vem à parte", async () => {
    const maria = await createCustomer(newName());
    const other = await createCustomer(newName());
    const batch = await upload([`${maria.name};;;x;100,00;;;;`]);
    const row = batch.rows[0];
    assert.equal(row.autoLinked, true);
    assert.equal(row.linkedCustomerName, maria.name);

    // Nome trocado para outra pessoa (sem cadastro): o vínculo cai.
    const typed = newName();
    const renamed = (await patch(batch.id, row.id, { data: { name: typed } })).rows[0];
    assert.equal(renamed.data.name, typed);
    assert.equal(renamed.customerAction.kind, "NEW");
    assert.equal(renamed.autoLinked, false);
    assert.equal(renamed.customerId, null);
    assert.equal(renamed.linkedCustomerName, null);

    // Volta a vincular só se o novo nome é idêntico a um único cliente.
    const relinked = (await patch(batch.id, row.id, { data: { name: other.name } })).rows[0];
    assert.equal(relinked.customerAction.kind, "LINK");
    assert.equal(relinked.customerAction.customerId, other.id);
    assert.equal(relinked.autoLinked, true);
    assert.equal(relinked.linkedCustomerName, other.name);

    // Editar outro campo não mexe no vínculo.
    const notes = (await patch(batch.id, row.id, { data: { notes: "x" } })).rows[0];
    assert.equal(notes.customerAction.customerId, other.id);
  });

  test("I-1: vínculo escolhido pela usuária continua depois de editar o nome, e a tela recebe os dois nomes", async () => {
    const maria = await createCustomer(newName());
    const batch = await upload([`${newName()};;;x;100,00;;;;`]);
    const row = batch.rows[0];
    const linked = (await patch(batch.id, row.id, { customerAction: { kind: "LINK", customerId: maria.id } })).rows[0];
    assert.equal(linked.autoLinked, false);
    assert.equal(linked.linkedCustomerName, maria.name);
    const typed = newName();
    const after = (await patch(batch.id, row.id, { data: { name: typed } })).rows[0];
    assert.equal(after.customerAction.kind, "LINK");
    assert.equal(after.customerAction.customerId, maria.id);
    assert.equal(after.data.name, typed);
    assert.equal(after.linkedCustomerName, maria.name);
  });

  test("I-1: \"é outra pessoa\" decidido para o nome antigo volta a ser reavaliado quando o nome muda", async () => {
    const maria = await createCustomer(newName());
    const ana = await createCustomer(newName());
    const batch = await upload([`${maria.name};;;x;100,00;;;;`]);
    const row = batch.rows[0];
    const decided = (await patch(batch.id, row.id, { customerAction: { kind: "NEW" } })).rows[0];
    assert.equal(decided.customerAction.confirmedNew, true);
    const after = (await patch(batch.id, row.id, { data: { name: ana.name } })).rows[0];
    assert.equal(after.customerAction.kind, "LINK");
    assert.equal(after.customerAction.customerId, ana.id);
    assert.equal(after.autoLinked, true);
  });
});
