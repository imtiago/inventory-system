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
import { readFileSync } from "node:fs";
import { keyShape } from "../../../../../test/keyShape";
import { BOUNDARY, multipart } from "../../../../nfe-import/infrastructure/http/__tests__/nfeTestNotes";

app.log.level = "silent";

const FIXTURES_DIR = new URL("../../../../../../../frontend/src/test/fixtures/legacy-import/", import.meta.url);

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

  test("I-2: mesma dívida já importada (cliente com dívida LEGACY em aberto de mesmo valor) → aviso que exige decisão; mesmo arquivo → sameFileAs", async () => {
    const maria = await createCustomer(newName());
    const content = [HEADER, `${maria.name};;;Sofá;300,00;;;;`, `${maria.name};;;Mesa;120,00;;;;`].join("\n");
    const first = await uploadRaw(content);
    assert.equal(first.statusCode, 201, first.body);
    const a = first.json().data as Batch;
    assert.equal(a.sameFileAs, null);
    assert.ok(a.rows.every((r) => !r.issues.some((i) => i.code === "POSSIBLE_DUPLICATE_DEBT")));
    assert.equal((await confirm(a.id)).statusCode, 200);

    // Mesmo arquivo de novo (o dono achou que o primeiro envio falhou).
    const second = await uploadRaw(content);
    assert.equal(second.statusCode, 201, second.body);
    const b = second.json().data as Batch;
    assert.equal(b.sameFileAs?.id, a.id);
    for (const row of b.rows) {
      const dup = row.issues.find((i) => i.code === "POSSIBLE_DUPLICATE_DEBT");
      assert.ok(dup, JSON.stringify(row.issues));
      assert.equal(dup.severity, "WARNING");
      assert.equal(dup.details?.batchId, a.id);
      assert.equal(dup.details?.accepted, false);
      assert.match(dup.message, new RegExp(a.id.slice(0, 8)));
      assert.equal(row.status, "WARNING");
      assert.equal(row.acceptDuplicate, false);
    }

    const blocked = await confirm(b.id);
    assert.equal(blocked.statusCode, 422, blocked.body);
    assert.equal(blocked.json().code, "UNRESOLVED_DUPLICATES");
    assert.deepEqual(blocked.json().details.lines, [2, 3]);

    // Linha 2: "Importar mesmo assim"; linha 3: ignorar.
    const accepted = (await patch(b.id, b.rows[0].id, { acceptDuplicate: true })).rows[0];
    assert.equal(accepted.acceptDuplicate, true);
    assert.equal(accepted.issues.find((i) => i.code === "POSSIBLE_DUPLICATE_DEBT")?.details?.accepted, true);
    const stillBlocked = await confirm(b.id);
    assert.equal(stillBlocked.statusCode, 422);
    assert.deepEqual(stillBlocked.json().details.lines, [3]);
    await patch(b.id, b.rows[1].id, { ignored: true });

    // Mudar o valor desfaz a escolha (era sobre aquela dívida).
    const changed = (await patch(b.id, b.rows[0].id, { data: { total: 301 } })).rows[0];
    assert.equal(changed.acceptDuplicate, false);
    assert.ok(!changed.issues.some((i) => i.code === "POSSIBLE_DUPLICATE_DEBT"));
    await patch(b.id, b.rows[0].id, { data: { total: 300 } });
    await patch(b.id, b.rows[0].id, { acceptDuplicate: true });

    const ok = await confirm(b.id);
    assert.equal(ok.statusCode, 200, ok.body);
    const docs = await prisma.financialDocument.count({ where: { partyId: maria.id, originType: "LEGACY", status: { not: "CANCELED" } } });
    assert.equal(docs, 3);
  });

  test("I-2: dívida antiga do lote desfeito não conta como repetida", async () => {
    const ana = await createCustomer(newName());
    const a = await upload([`${ana.name};;;x;77,00;;;;`]);
    assert.equal((await confirm(a.id)).statusCode, 200);
    assert.equal((await revert(a.id)).statusCode, 200);
    const b = await upload([`${ana.name};;;x;77,00;;;;`]);
    assert.ok(!b.rows[0].issues.some((i) => i.code === "POSSIBLE_DUPLICATE_DEBT"));
    assert.equal(b.sameFileAs, null);
  });

  test("I-5: desfazer restaura o limite/perfil que a importação mudou, se não mudou desde então; senão mantém e informa", async () => {
    const kept = await createCustomer(newName(), { creditLimit: 100 });
    const changed = await createCustomer(newName(), { creditLimit: 100 });
    const untouched = await createCustomer(newName(), { creditLimit: 5000 });
    const batch = await upload([
      `${kept.name};;;x;700,00;;;Regular;`,
      `${changed.name};;;y;500,00;;;;`,
      `${untouched.name};;;z;50,00;;;;`,
    ]);
    assert.deepEqual(batch.rows.map((r) => r.customerAction.kind), ["LINK", "LINK", "LINK"]);
    assert.equal((await confirm(batch.id)).statusCode, 200);
    const limitOf = async (id: string) => {
      const c = await prisma.customer.findUniqueOrThrow({ where: { id } });
      return { limit: Number(c.creditLimit), profile: c.creditProfileCode };
    };
    assert.deepEqual(await limitOf(kept.id), { limit: 800, profile: "REGULAR" });
    assert.deepEqual(await limitOf(changed.id), { limit: 500, profile: "NEW" });
    assert.deepEqual(await limitOf(untouched.id), { limit: 5000, profile: "NEW" });

    // Ajuste manual depois da importação: o desfazer não pode passar por cima.
    const manual = await app.inject({
      method: "PUT",
      url: `/customers/${changed.id}/credit`,
      headers: { authorization: `Bearer ${admin.token}` },
      payload: { limit: 900, reason: "Ajuste manual" },
    });
    assert.equal(manual.statusCode, 200, manual.body);

    const res = await revert(batch.id);
    assert.equal(res.statusCode, 200, res.body);
    const { creditRestore } = res.json().data as {
      creditRestore: { restored: { customerId: string; name: string }[]; notRestored: { customerId: string; name: string }[] };
    };
    assert.deepEqual(creditRestore.restored, [{ customerId: kept.id, name: kept.name }]);
    assert.deepEqual(creditRestore.notRestored, [{ customerId: changed.id, name: changed.name }]);
    const fixture = JSON.parse(readFileSync(new URL("legacyBatchReverted.json", FIXTURES_DIR), "utf8")) as { data: object };
    assert.deepEqual(keyShape({ ...res.json().data, rows: [] }), keyShape({ ...fixture.data, rows: [] }));

    assert.deepEqual(await limitOf(kept.id), { limit: 100, profile: "NEW" });
    assert.deepEqual(await limitOf(changed.id), { limit: 900, profile: "NEW" });
    assert.deepEqual(await limitOf(untouched.id), { limit: 5000, profile: "NEW" });

    const last = await prisma.creditLimitChange.findFirstOrThrow({ where: { customerId: kept.id }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
    assert.equal(last.source, "LEGACY_IMPORT");
    assert.equal(last.reason, "Lote desfeito");
    assert.equal(Number(last.fromLimit), 800);
    assert.equal(Number(last.toLimit), 100);
    assert.equal(last.changedById, admin.id);
    assert.equal(await prisma.creditLimitChange.count({ where: { customerId: changed.id, reason: "Lote desfeito" } }), 0);
  });
});
