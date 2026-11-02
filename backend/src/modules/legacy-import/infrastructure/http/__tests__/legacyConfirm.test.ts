import "dotenv/config";
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { prisma } from "@shared/prisma";
import { todayInBusinessTz } from "@shared/domain/businessDate";
import { PrismaCreditHistoryReader } from "@credit/infrastructure/prisma/PrismaCreditHistoryReader";
import { PrismaCreditSettingsRepository } from "@credit/infrastructure/prisma/PrismaCreditSettingsRepository";
import { app } from "../../../../../app";
import { createTestUser, type TestUser } from "../../../../../test/authFixtures";
import { keyShape } from "../../../../../test/keyShape";
import { newIdempotencyKey } from "../../../../../test/idempotency";
import { acquireCreditTestLock } from "../../../../../test/creditTestLock";
import { resetCreditDefaults } from "../../../../../test/creditFixtures";
import { deleteFinancialDocuments } from "../../../../../test/cleanup";
import { BOUNDARY, multipart } from "../../../../nfe-import/infrastructure/http/__tests__/nfeTestNotes";

app.log.level = "silent";

const FIXTURES_DIR = new URL("../../../../../../../frontend/src/test/fixtures/legacy-import/", import.meta.url);
const loadFixture = (name: string): unknown => JSON.parse(readFileSync(new URL(`${name}.json`, FIXTURES_DIR), "utf8"));

const word = () =>
  Array.from(randomBytes(8))
    .map((b) => String.fromCharCode(97 + (b % 26)))
    .join("");
const cap = (w: string) => w[0].toUpperCase() + w.slice(1);
const newName = () => `${cap(word())} ${cap(word())}`;

const HEADER = "nome;celular;data_compra;descricao;valor_total;valor_pago;vencimentos;perfil;observacao";
const TODAY = todayInBusinessTz();
const addDays = (days: number) => {
  const d = new Date(`${TODAY}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const br = (iso: string) => iso.split("-").reverse().join("/");

type Row = { id: string; status: string; customerId: string | null; financialDocumentId: string | null };

describe("Confirmar e desfazer lote do caderninho", () => {
  let admin: TestUser;
  let vendedor: TestUser;
  let releaseCreditLock: () => Promise<void>;
  const batchIds: string[] = [];
  const extraCustomerIds: string[] = [];

  before(async () => {
    // O limite depende dos perfis (globais): segura o lock de crédito o arquivo todo.
    releaseCreditLock = await acquireCreditTestLock();
    await resetCreditDefaults();
    admin = await createTestUser({ role: "ADMIN" });
    vendedor = await createTestUser({ role: "VENDEDOR" });
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
      await vendedor.cleanup();
    } finally {
      await releaseCreditLock();
      await app.close();
      await prisma.$disconnect();
    }
  });

  const call = (method: "GET" | "POST" | "PATCH", url: string, payload?: object, user = admin, key?: string) =>
    app.inject({
      method,
      url,
      headers: {
        authorization: `Bearer ${user.token}`,
        ...(method === "POST" ? { "idempotency-key": key ?? newIdempotencyKey() } : {}),
      },
      payload,
    });

  const upload = async (lines: string[]) => {
    const res = await app.inject({
      method: "POST",
      url: "/legacy-imports/csv",
      headers: { authorization: `Bearer ${admin.token}`, "content-type": `multipart/form-data; boundary=${BOUNDARY}` },
      payload: multipart([{ name: "file", filename: "caderno.csv", contentType: "text/csv", content: [HEADER, ...lines].join("\n") }]),
    });
    assert.equal(res.statusCode, 201, res.body);
    batchIds.push(res.json().data.id);
    return res.json().data as { id: string; rows: (Row & { issues: { code: string }[] })[] };
  };

  const confirm = (id: string, body: object = {}, key?: string) => call("POST", `/legacy-imports/${id}/confirm`, body, admin, key);
  const revert = (id: string, key?: string) => call("POST", `/legacy-imports/${id}/revert`, {}, admin, key);
  const legacyDocs = (rowIds: string[]) =>
    prisma.financialDocument.findMany({
      where: { originType: "LEGACY", originId: { in: rowIds } },
      include: { parcels: { orderBy: { dueDate: "asc" } } },
    });

  test("confirma: cliente novo criado com código, documento LEGACY noLateFees, parcela única a combinar; perfil Bom aplicado com histórico LEGACY_IMPORT", async () => {
    const name = newName();
    const batch = await upload([`${name};(11) 98888-7777;05/03/2026;Sofá;500,00;200,00;;Bom;`]);
    const res = await confirm(batch.id);
    assert.equal(res.statusCode, 200, res.body);
    const data = res.json().data;
    assert.equal(data.status, "CONFIRMED");
    assert.equal(data.limitRule, "MAX_OF_PROFILE_AND_BALANCE");
    assert.ok(data.confirmedAt);
    assert.equal(data.revertedAt, null);
    const fixture = loadFixture("legacyBatch") as { data: { rows: object[] } };
    assert.deepEqual(keyShape({ ...data, rows: [] }), keyShape({ ...fixture.data, rows: [] }));
    assert.deepEqual(Object.keys(data.rows[0]).sort(), Object.keys(fixture.data.rows[0]).sort());

    const row: Row = data.rows[0];
    assert.ok(row.customerId);
    assert.ok(row.financialDocumentId);
    const customer = await prisma.customer.findUniqueOrThrow({ where: { id: row.customerId! } });
    assert.equal(customer.name, name);
    assert.equal(customer.phone, "11988887777");
    assert.match(customer.code, /^C/);
    assert.equal(customer.creditProfileCode, "GOOD");
    assert.equal(Number(customer.creditLimit), 2000);

    const [doc] = await legacyDocs([row.id]);
    assert.equal(doc.id, row.financialDocumentId);
    assert.equal(doc.type, "RECEIVABLE");
    assert.equal(doc.partyType, "CUSTOMER");
    assert.equal(doc.partyId, customer.id);
    assert.equal(doc.noLateFees, true);
    assert.equal(doc.status, "OPEN");
    assert.equal(doc.parcels.length, 1);
    assert.equal(Number(doc.parcels[0].amount), 300);
    assert.equal(doc.parcels[0].dueDateUnknown, true);
    assert.equal(doc.parcels[0].dueDate.toISOString().slice(0, 10), TODAY);

    const changes = await prisma.creditLimitChange.findMany({ where: { customerId: customer.id } });
    assert.equal(changes.length, 1);
    assert.equal(changes[0].source, "LEGACY_IMPORT");
    assert.equal(changes[0].toProfile, "GOOD");
    assert.equal(Number(changes[0].toLimit), 2000);
    assert.equal(changes[0].changedById, admin.id);
    assert.ok(changes[0].reason.startsWith("Migração do caderninho (lote "), changes[0].reason);

    // GET do lote confirmado mostra o que foi gravado (sem reavaliar nomes contra o cliente recém-criado).
    const again = await call("GET", `/legacy-imports/${batch.id}`);
    assert.equal(again.statusCode, 200);
    assert.equal(again.json().data.status, "CONFIRMED");
    assert.equal(again.json().data.rows[0].customerId, customer.id);
    assert.deepEqual(again.json().data.rows[0].issues.filter((i: { code: string }) => i.code.startsWith("SIMILAR")), []);
    const list = await call("GET", "/legacy-imports?limit=50");
    assert.deepEqual(keyShape(list.json()), keyShape(loadFixture("legacyBatches")));
  });

  test("linha com vencimentos → parcelas nas datas; vencimento passado entra sem encargos, conta no limite e não bloqueia por atraso nem afeta a pontuação", async () => {
    const past = addDays(-40);
    const future = addDays(20);
    const batch = await upload([`${newName()};;;Geladeira;200,00;;"${br(past)}=120,00; ${br(future)}=80,00";;`]);
    const res = await confirm(batch.id);
    assert.equal(res.statusCode, 200, res.body);
    const row: Row = res.json().data.rows[0];
    const [doc] = await legacyDocs([row.id]);
    assert.deepEqual(
      doc.parcels.map((p) => [p.dueDate.toISOString().slice(0, 10), Number(p.amount), p.dueDateUnknown]),
      [
        [past, 120, false],
        [future, 80, false],
      ],
    );

    const detail = await call("GET", `/receivables/${doc.id}`);
    assert.equal(detail.statusCode, 200, detail.body);
    const pastParcel = detail.json().data.parcels[0];
    assert.equal(pastParcel.lateFeesToday.fine, 0);
    assert.equal(pastParcel.lateFeesToday.interest, 0);

    const credit = await call("GET", `/customers/${row.customerId}/credit`);
    assert.equal(credit.statusCode, 200, credit.body);
    assert.equal(credit.json().data.openBalance, 200);
    assert.equal(credit.json().data.currentMaxOverdueDays, 0);
    assert.equal(credit.json().data.limit, 300);

    const history = (await new PrismaCreditHistoryReader(new PrismaCreditSettingsRepository()).forCustomers([row.customerId!], TODAY, 12)).get(row.customerId!);
    assert.ok(history);
    assert.equal(history.currentMaxOverdueDays, 0);
    assert.equal(history.maxDaysLateInPeriod, 0);
    assert.equal(history.paidInstallments, 0);
  });

  test("limite: perfil Novo (300) e saldo importado 450 → limite 450; PROFILE_ONLY → 300; cliente existente sem perfil mantém limite maior", async () => {
    const a = await upload([`${newName()};;;x;450,00;;;Novo;`]);
    const resA = await confirm(a.id);
    assert.equal(resA.statusCode, 200, resA.body);
    const custA = await prisma.customer.findUniqueOrThrow({ where: { id: resA.json().data.rows[0].customerId } });
    assert.equal(custA.creditProfileCode, "NEW");
    assert.equal(Number(custA.creditLimit), 450);

    const b = await upload([`${newName()};;;x;450,00;;;Novo;`]);
    const resB = await confirm(b.id, { limitRule: "PROFILE_ONLY" });
    assert.equal(resB.statusCode, 200, resB.body);
    assert.equal(resB.json().data.limitRule, "PROFILE_ONLY");
    const custB = await prisma.customer.findUniqueOrThrow({ where: { id: resB.json().data.rows[0].customerId } });
    assert.equal(Number(custB.creditLimit), 300);

    // Cliente existente (limite 1.000) vinculado, duas linhas somando 1.200 sem perfil → max(1.000, 1.200).
    const existing = await prisma.customer.create({
      data: { name: newName(), code: `tx-test-${randomUUID()}`, creditProfileCode: "REGULAR", creditLimit: 1000 },
    });
    extraCustomerIds.push(existing.id);
    const c = await upload([`${existing.name};;;x;700,00;;;;`, `${existing.name};;;y;500,00;;;;`]);
    assert.deepEqual(
      c.rows.map((r) => (r as unknown as { customerAction: { kind: string } }).customerAction.kind),
      ["LINK", "LINK"],
    );
    const resC = await confirm(c.id);
    assert.equal(resC.statusCode, 200, resC.body);
    const custC = await prisma.customer.findUniqueOrThrow({ where: { id: existing.id } });
    assert.equal(custC.creditProfileCode, "REGULAR");
    assert.equal(Number(custC.creditLimit), 1200);
    assert.equal((await legacyDocs(c.rows.map((r) => r.id))).length, 2);
    assert.equal(await prisma.creditLimitChange.count({ where: { customerId: existing.id, source: "LEGACY_IMPORT" } }), 1);
  });

  test("linha com ERROR → 422 LEGACY_BATCH_HAS_ERRORS; SIMILAR sem decisão → 422 UNRESOLVED_SIMILAR_NAMES; IGNORED fica de fora", async () => {
    const bad = await upload([`${newName()};;;x;100,00;150,00;;;`, `${newName()};;;y;10,00;;;;`]);
    const res = await confirm(bad.id);
    assert.equal(res.statusCode, 422, res.body);
    assert.equal(res.json().code, "LEGACY_BATCH_HAS_ERRORS");
    assert.equal(res.json().message, "Corrija as linhas com erro antes de confirmar.");
    assert.deepEqual(res.json().details.lines, [2]);
    assert.equal((await prisma.legacyImportBatch.findUniqueOrThrow({ where: { id: bad.id } })).status, "DRAFT");

    // Ignorar a linha com erro libera a confirmação; a ignorada não gera dívida nem cliente.
    const ign = await call("PATCH", `/legacy-imports/${bad.id}/rows/${bad.rows[0].id}`, { ignored: true });
    assert.equal(ign.statusCode, 200, ign.body);
    const ok = await confirm(bad.id);
    assert.equal(ok.statusCode, 200, ok.body);
    const [ignoredRow, okRow] = ok.json().data.rows as Row[];
    assert.equal(ignoredRow.status, "IGNORED");
    assert.equal(ignoredRow.financialDocumentId, null);
    assert.equal(ignoredRow.customerId, null);
    assert.ok(okRow.financialDocumentId);
    assert.equal((await legacyDocs([ignoredRow.id])).length, 0);

    // Inicial fixa "M": uma inicial aleatória "E" vira partícula ("e") e some da comparação (teste instável).
    const [w1, w2, w3] = [cap(word()), `M${word()}`, cap(word())];
    const existing = await prisma.customer.create({ data: { name: `${w1} ${w2} ${w3}`, code: `tx-test-${randomUUID()}` } });
    extraCustomerIds.push(existing.id);
    const similar = await upload([`${w1} ${w2[0]}. ${w3};;;x;100,00;;;;`]);
    assert.ok(similar.rows[0].issues.some((i) => i.code === "SIMILAR_CUSTOMER"));
    const pending = await confirm(similar.id);
    assert.equal(pending.statusCode, 422, pending.body);
    assert.equal(pending.json().code, "UNRESOLVED_SIMILAR_NAMES");
    assert.equal(pending.json().message, "Decida se os nomes parecidos são a mesma pessoa.");
    assert.deepEqual(pending.json().details.lines, [2]);

    const decided = await call("PATCH", `/legacy-imports/${similar.id}/rows/${similar.rows[0].id}`, { customerAction: { kind: "NEW" } });
    assert.equal(decided.statusCode, 200, decided.body);
    const done = await confirm(similar.id);
    assert.equal(done.statusCode, 200, done.body);
    assert.notEqual(done.json().data.rows[0].customerId, existing.id);
  });

  test("falha no meio (cliente vinculado apagado entre revisão e confirmação) → nada gravado", async () => {
    const linked = await prisma.customer.create({ data: { name: newName(), code: `tx-test-${randomUUID()}` } });
    const freshName = newName();
    const batch = await upload([`${freshName};;;x;100,00;;;Bom;`, `${linked.name};;;y;50,00;;;;`]);
    assert.equal((batch.rows[1] as unknown as { customerAction: { kind: string } }).customerAction.kind, "LINK");
    await prisma.customer.delete({ where: { id: linked.id } });

    const res = await confirm(batch.id);
    assert.equal(res.statusCode, 404, res.body);
    assert.equal(res.json().code, "CUSTOMER_NOT_FOUND");
    assert.equal(await prisma.customer.count({ where: { name: freshName } }), 0);
    assert.equal((await legacyDocs(batch.rows.map((r) => r.id))).length, 0);
    const stored = await prisma.legacyImportBatch.findUniqueOrThrow({ where: { id: batch.id }, include: { rows: true } });
    assert.equal(stored.status, "DRAFT");
    assert.equal(stored.confirmedAt, null);
    assert.ok(stored.rows.every((r) => r.financialDocumentId === null));
  });

  for (const round of [1, 2]) {
    test(`mesma Idempotency-Key → replay, sem duplicar; duas confirmações simultâneas com chaves diferentes → uma 200, outra 409 LEGACY_BATCH_NOT_DRAFT (${round})`, async () => {
      const batch = await upload([`${newName()};;;x;100,00;;;;`, `${newName()};;;y;60,00;;;;`]);
      const key = newIdempotencyKey();
      const first = await confirm(batch.id, {}, key);
      assert.equal(first.statusCode, 200, first.body);
      const replay = await confirm(batch.id, {}, key);
      assert.equal(replay.statusCode, 200, replay.body);
      assert.equal(replay.headers["idempotent-replayed"], "true");
      assert.deepEqual(replay.json(), first.json());
      assert.equal((await legacyDocs(batch.rows.map((r) => r.id))).length, 2);

      const other = await upload([`${newName()};;;x;100,00;;;;`, `${newName()};;;y;60,00;;;;`]);
      const results = await Promise.all([confirm(other.id), confirm(other.id)]);
      const codes = results.map((r) => r.statusCode).sort();
      assert.deepEqual(codes, [200, 409], results.map((r) => r.body).join("\n"));
      const loser = results.find((r) => r.statusCode === 409)!;
      assert.equal(loser.json().code, "LEGACY_BATCH_NOT_DRAFT");
      const docs = await legacyDocs(other.rows.map((r) => r.id));
      assert.equal(docs.length, 2);
      const rows = await prisma.legacyImportRow.findMany({ where: { batchId: other.id } });
      const customers = new Set(rows.map((r) => r.customerId));
      assert.equal(customers.size, 2);
      assert.equal(
        await prisma.customer.count({ where: { id: { in: [...customers].filter((x): x is string => !!x) } } }),
        2,
      );
    });
  }

  test("desfazer sem pagamento → documentos CANCELED, lote REVERTED, clientes mantidos com limite/perfil de antes", async () => {
    const batch = await upload([`${newName()};;;x;450,00;;;Novo;`, `${newName()};;;y;80,00;;;Regular;`]);
    const ok = await confirm(batch.id);
    assert.equal(ok.statusCode, 200, ok.body);
    const customerIds = (ok.json().data.rows as Row[]).map((r) => r.customerId!);

    const res = await revert(batch.id);
    assert.equal(res.statusCode, 200, res.body);
    assert.equal(res.json().data.status, "REVERTED");
    assert.ok(res.json().data.revertedAt);
    const docs = await legacyDocs(batch.rows.map((r) => r.id));
    assert.equal(docs.length, 2);
    assert.ok(docs.every((d) => d.status === "CANCELED"));
    const customers = await prisma.customer.findMany({ where: { id: { in: customerIds } }, orderBy: { name: "asc" } });
    assert.equal(customers.length, 2);
    // Clientes ficam; perfil e limite que a importação deu voltam ao de antes (sem mudança desde então).
    const byId = new Map(customers.map((c) => [c.id, c]));
    assert.equal(Number(byId.get(customerIds[0])!.creditLimit), 300);
    assert.equal(byId.get(customerIds[0])!.creditProfileCode, "NEW");
    assert.equal(Number(byId.get(customerIds[1])!.creditLimit), 300);
    assert.equal(byId.get(customerIds[1])!.creditProfileCode, "NEW");
    assert.deepEqual(
      (res.json().data.creditRestore.restored as { customerId: string }[]).map((c) => c.customerId).sort(),
      [...customerIds].sort(),
    );
    assert.deepEqual(res.json().data.creditRestore.notRestored, []);

    const credit = await call("GET", `/customers/${customerIds[0]}/credit`);
    assert.equal(credit.json().data.openBalance, 0);

    const twice = await revert(batch.id);
    assert.equal(twice.statusCode, 409, twice.body);
    assert.equal(twice.json().code, "LEGACY_BATCH_NOT_CONFIRMED");
    const draft = await upload([`${newName()};;;x;10,00;;;;`]);
    const notConfirmed = await revert(draft.id);
    assert.equal(notConfirmed.statusCode, 409);
    assert.equal(notConfirmed.json().code, "LEGACY_BATCH_NOT_CONFIRMED");
    assert.equal((await revert(randomUUID())).statusCode, 404);
  });

  test("desfazer com pagamento em uma dívida → 409 LEGACY_BATCH_HAS_PAYMENTS e nada muda; estornado o pagamento, desfaz", async () => {
    const batch = await upload([`${newName()};;;x;100,00;;;;`, `${newName()};;;y;60,00;;;;`]);
    const ok = await confirm(batch.id);
    assert.equal(ok.statusCode, 200, ok.body);
    const docId = (ok.json().data.rows as Row[])[1].financialDocumentId!;
    const parcel = await prisma.financialParcel.findFirstOrThrow({ where: { financialDocumentId: docId } });
    const pay = await call("POST", `/receivables/${docId}/parcels/${parcel.id}/payments`, { amount: 10, method: "CASH" });
    assert.equal(pay.statusCode, 201, pay.body);

    const res = await revert(batch.id);
    assert.equal(res.statusCode, 409, res.body);
    assert.equal(res.json().code, "LEGACY_BATCH_HAS_PAYMENTS");
    assert.equal(res.json().message, "Alguma dívida deste lote já recebeu pagamento.");
    const docs = await legacyDocs(batch.rows.map((r) => r.id));
    assert.deepEqual(docs.map((d) => d.status).sort(), ["OPEN", "PARTIALLY_PAID"]);
    assert.equal((await prisma.legacyImportBatch.findUniqueOrThrow({ where: { id: batch.id } })).status, "CONFIRMED");

    const paymentId = pay.json().data.parcels[0].payments[0].id;
    const rev = await call("POST", `/receivables/payments/${paymentId}/reverse`, { reason: "teste" });
    assert.equal(rev.statusCode, 200, rev.body);
    const undone = await revert(batch.id);
    assert.equal(undone.statusCode, 200, undone.body);
    assert.equal(undone.json().data.status, "REVERTED");
  });

  test("pagamento de dívida antiga por VENDEDOR (finance.pay) funciona e não cobra multa/juros", async () => {
    const past = addDays(-60);
    const batch = await upload([`${newName()};;;x;100,00;;${br(past)}=100,00;;`]);
    const ok = await confirm(batch.id);
    assert.equal(ok.statusCode, 200, ok.body);
    const docId = (ok.json().data.rows as Row[])[0].financialDocumentId!;
    const parcel = await prisma.financialParcel.findFirstOrThrow({ where: { financialDocumentId: docId } });
    const pay = await call("POST", `/receivables/${docId}/parcels/${parcel.id}/payments`, { amount: 100, method: "PIX" }, vendedor);
    assert.equal(pay.statusCode, 201, pay.body);
    assert.equal(pay.json().data.status, "PAID");
    const payment = pay.json().data.parcels[0].payments[0];
    assert.equal(payment.amount, 100);
    assert.equal(payment.fineAmount, 0);
    assert.equal(payment.interestAmount, 0);
  });

  test("VENDEDOR não confirma nem desfaz (credit.manage)", async () => {
    const batch = await upload([`${newName()};;;x;10,00;;;;`]);
    assert.equal((await call("POST", `/legacy-imports/${batch.id}/confirm`, {}, vendedor)).statusCode, 403);
    assert.equal((await call("POST", `/legacy-imports/${batch.id}/revert`, {}, vendedor)).statusCode, 403);
    const noKey = await app.inject({
      method: "POST",
      url: `/legacy-imports/${batch.id}/confirm`,
      headers: { authorization: `Bearer ${admin.token}` },
      payload: {},
    });
    assert.equal(noKey.statusCode, 400);
    assert.equal(noKey.json().code, "IDEMPOTENCY_KEY_REQUIRED");
  });
});
