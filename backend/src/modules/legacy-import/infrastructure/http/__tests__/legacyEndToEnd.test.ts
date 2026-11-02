import "dotenv/config";
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { prisma } from "@shared/prisma";
import { todayInBusinessTz } from "@shared/domain/businessDate";
import { app } from "../../../../../app";
import { createTestUser, type TestUser } from "../../../../../test/authFixtures";
import { newIdempotencyKey } from "../../../../../test/idempotency";
import { acquireCreditTestLock } from "../../../../../test/creditTestLock";
import { resetCreditDefaults } from "../../../../../test/creditFixtures";
import { deleteFinancialDocuments } from "../../../../../test/cleanup";
import { parseCsv } from "../../../../../test/csvParse";
import { BOUNDARY, multipart } from "../../../../nfe-import/infrastructure/http/__tests__/nfeTestNotes";

app.log.level = "silent";

const word = () =>
  Array.from(randomBytes(8))
    .map((b) => String.fromCharCode(97 + (b % 26)))
    .join("");
const cap = (w: string) => w[0].toUpperCase() + w.slice(1);

const HEADER = "nome;celular;data_compra;descricao;valor_total;valor_pago;vencimentos;perfil;observacao";
const TODAY = todayInBusinessTz();
const addDays = (days: number) => {
  const d = new Date(`${TODAY}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const br = (iso: string) => iso.split("-").reverse().join("/");

type Issue = { code: string; severity: string; message: string };
type Row = {
  id: string;
  line: number;
  status: string;
  raw: Record<string, string>;
  data: { name: string; open: number; dueDates: { date: string; amount: number }[] | null };
  issues: Issue[];
  customerAction: { kind: string; customerId?: string; rowId?: string };
  autoLinked: boolean;
  customerId: string | null;
  financialDocumentId: string | null;
};

/**
 * Roteiro ponta a ponta do caderninho pela camada HTTP (banco de teste): planilha bagunçada → revisão →
 * correções e decisões → confirmação idempotente → contas a receber (lista, detalhe, CSV), painel,
 * ficha de crédito → parcelar saldo → pagamento bloqueia o desfazer → estorno → desfazer.
 */
describe("Caderninho ponta a ponta (planilha bagunçada)", () => {
  let admin: TestUser;
  let releaseCreditLock: () => Promise<void>;
  let batchId = "";
  const extraCustomerIds: string[] = [];

  before(async () => {
    releaseCreditLock = await acquireCreditTestLock();
    await resetCreditDefaults();
    admin = await createTestUser({ role: "ADMIN" });
  });

  after(async () => {
    try {
      const rows = batchId ? await prisma.legacyImportRow.findMany({ where: { batchId }, select: { id: true, customerId: true } }) : [];
      const customerIds = [...new Set([...rows.map((r) => r.customerId).filter((x): x is string => !!x), ...extraCustomerIds])];
      if (batchId) await prisma.legacyImportBatch.deleteMany({ where: { id: batchId } });
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

  const call = (method: "GET" | "POST" | "PATCH", url: string, payload?: object, key?: string) =>
    app.inject({
      method,
      url,
      headers: {
        authorization: `Bearer ${admin.token}`,
        ...(method === "POST" ? { "idempotency-key": key ?? newIdempotencyKey() } : {}),
      },
      payload,
    });

  test("importar, revisar, resolver, confirmar, conferir, parcelar, pagar, desfazer", async () => {
    const [w, m, s, p, r, a, c] = Array.from({ length: 7 }, () => cap(word()));
    const existing = await prisma.customer.create({ data: { name: `José da Silva ${w}`, code: `tx-test-${randomUUID()}` } });
    extraCustomerIds.push(existing.id);

    const past30 = addDays(-30);
    const future30 = addDays(30);
    const past60 = addDays(-60);
    const csv = [
      HEADER,
      `Jose da Silva ${w};;;Bicicleta;R$ 150,00;;;;`, // 2: sem acento → vínculo automático
      `Maria Aparecida ${m};(11) 98888-7777;05/03/2026;Sofá;1.200,00;200,00;"${br(past30)}=500,00; ${br(future30)}=500,00";Regular;Paga em mãos`, // 3
      `Maria A. ${m};;10/04/2026;Mesa;80,00;;;;`, // 4: parecida com a 3
      `João Souza ${s};;;Fogão;850,00;;;;`, // 5: sem celular nem data
      `Joana Souza ${s};11977776666;01/02/2026;Geladeira;400,00;100,00;;;`, // 6: não é a mesma do João
      `Pedro Paulo ${p};;01/02/2026;Cama;100,00;150,00;;;`, // 7: pago > total
      `Rita Cruz ${r};;01/02/2026;Rack;12,5O;;;;`, // 8: valor ilegível
      `Ana Lúcia ${a};;;Colchão;300,00;;;Bom;`, // 9: a combinar, perfil Bom
      `TOTAL DA PÁGINA;;;;5.000,00;;;;`, // 10: lixo da transcrição → ignorar
      `Carla Dias ${c};;15/06/2026;Sapato;80,00;;${br(past60)}=80,00;;`, // 11: vencimento passado
    ].join("\r\n");

    // 1) Envio e revisão
    const up = await app.inject({
      method: "POST",
      url: "/legacy-imports/csv",
      headers: { authorization: `Bearer ${admin.token}`, "content-type": `multipart/form-data; boundary=${BOUNDARY}` },
      payload: multipart([{ name: "file", filename: "caderno.csv", contentType: "text/csv", content: csv }]),
    });
    assert.equal(up.statusCode, 201, up.body);
    batchId = up.json().data.id;
    let rows: Row[] = up.json().data.rows;
    const at = (line: number) => rows.find((x) => x.line === line)!;
    assert.equal(rows.length, 10);
    assert.deepEqual(at(2).customerAction, { kind: "LINK", customerId: existing.id });
    assert.equal(at(2).autoLinked, true);
    assert.equal(at(3).data.dueDates?.length, 2);
    assert.equal(at(3).data.open, 1000);
    assert.ok(at(4).issues.some((i) => i.code === "SIMILAR_ROW"));
    assert.equal(at(5).status, "WARNING");
    assert.deepEqual(at(5).issues.map((i) => i.code).sort(), ["NO_DATE", "NO_PHONE"]);
    assert.ok(!at(6).issues.some((i) => i.code.startsWith("SIMILAR")), "Joana não é o João");
    assert.equal(at(7).status, "ERROR");
    assert.equal(at(8).status, "ERROR");
    assert.equal(at(8).raw.valor_total, "12,5O");
    assert.equal(at(9).data.dueDates, null);

    // 2) Confirmar com erro → 422 com as linhas
    const early = await call("POST", `/legacy-imports/${batchId}/confirm`, {});
    assert.equal(early.statusCode, 422, early.body);
    assert.equal(early.json().code, "LEGACY_BATCH_HAS_ERRORS");
    assert.deepEqual(early.json().details.lines, [7, 8]);

    // 3) Correções
    const patch = async (line: number, body: object) => {
      const res = await call("PATCH", `/legacy-imports/${batchId}/rows/${at(line).id}`, body);
      assert.equal(res.statusCode, 200, res.body);
      rows = res.json().data.rows;
    };
    await patch(7, { data: { paid: 50 } });
    await patch(8, { data: { total: 125 } });
    await patch(10, { ignored: true });
    assert.equal(at(8).raw.valor_total, "125,00");

    const similar = await call("POST", `/legacy-imports/${batchId}/confirm`, {});
    assert.equal(similar.statusCode, 422, similar.body);
    assert.equal(similar.json().code, "UNRESOLVED_SIMILAR_NAMES");
    assert.equal(similar.json().message, "Decida se os nomes parecidos são a mesma pessoa.");
    assert.deepEqual(similar.json().details.lines, [4]);
    await patch(4, { customerAction: { kind: "SAME_AS_ROW", rowId: at(3).id } });

    // 4) Confirmação idempotente
    const key = newIdempotencyKey();
    const ok = await call("POST", `/legacy-imports/${batchId}/confirm`, { limitRule: "MAX_OF_PROFILE_AND_BALANCE" }, key);
    assert.equal(ok.statusCode, 200, ok.body);
    const confirmed = ok.json().data;
    assert.equal(confirmed.status, "CONFIRMED");
    assert.deepEqual(
      { newCustomers: confirmed.summary.newCustomers, existingCustomers: confirmed.summary.existingCustomers, ignored: confirmed.summary.ignored },
      { newCustomers: 7, existingCustomers: 1, ignored: 1 },
    );
    assert.equal(confirmed.summary.openTotal, 150 + 1000 + 80 + 850 + 300 + 50 + 125 + 300 + 80);
    const replay = await call("POST", `/legacy-imports/${batchId}/confirm`, { limitRule: "MAX_OF_PROFILE_AND_BALANCE" }, key);
    assert.equal(replay.statusCode, 200);
    assert.equal(replay.headers["idempotent-replayed"], "true");
    rows = confirmed.rows;
    assert.equal(at(10).financialDocumentId, null);
    assert.equal(at(3).customerId, at(4).customerId, "Maria A. juntou com a Maria Aparecida");
    assert.equal(at(2).customerId, existing.id);
    const docCount = await prisma.financialDocument.count({ where: { originType: "LEGACY", originId: { in: rows.map((x) => x.id) } } });
    assert.equal(docCount, 9);

    // 5) Contas a receber: lista, detalhe e CSV
    const maria = at(3).customerId!;
    const list = await call("GET", `/receivables?customerId=${maria}`);
    assert.equal(list.statusCode, 200);
    assert.equal(list.json().data.length, 2);
    assert.ok(list.json().data.every((d: { originType: string }) => d.originType === "LEGACY"));

    const ana = at(9).customerId!;
    const anaList = (await call("GET", `/receivables?customerId=${ana}`)).json();
    assert.equal(anaList.data[0].hasDueDateUnknown, true);
    assert.equal(anaList.data[0].nextDueDate, null);
    assert.equal(anaList.summary.overdueAmount, 0);
    assert.deepEqual((await call("GET", `/receivables?customerId=${ana}&status=OVERDUE`)).json().data, []);

    const carlaDoc = at(11).financialDocumentId!;
    const carlaDetail = (await call("GET", `/receivables/${carlaDoc}`)).json().data;
    assert.equal(carlaDetail.noLateFees, true);
    assert.equal(carlaDetail.parcels[0].dueDateUnknown, false);
    assert.equal(carlaDetail.parcels[0].lateFeesToday.fine, 0);
    assert.equal(carlaDetail.parcels[0].lateFeesToday.interest, 0);
    assert.equal(carlaDetail.parcels[0].lateFeesToday.totalDue, 80);

    const csvRes = await call("GET", `/reports/receivables.csv?customerId=${ana}`);
    assert.equal(csvRes.statusCode, 200);
    const [header, ...csvRows] = parseCsv(csvRes.body);
    assert.equal(csvRows[0][header.indexOf("Origem")], "Caderninho");
    assert.equal(csvRows[0][header.indexOf("Vencimento")], "A combinar");

    const dashboard = await call("GET", "/dashboard");
    assert.equal(dashboard.statusCode, 200, dashboard.body);
    assert.ok(dashboard.json().data.receivables, "seção de contas a receber do painel");

    // 6) Ficha de crédito: saldo conta, nunca atraso, sem bloqueio
    const mariaCredit = (await call("GET", `/customers/${maria}/credit`)).json().data;
    assert.equal(mariaCredit.profileCode, "REGULAR");
    assert.equal(mariaCredit.openBalance, 1080);
    assert.equal(mariaCredit.legacyOpenBalance, 1080);
    assert.equal(mariaCredit.limit, 1080, "limite = maior entre o do perfil (1.000) e o saldo importado");
    assert.equal(mariaCredit.currentMaxOverdueDays, 0, "vencimento passado do caderninho não conta como atraso");
    assert.equal(mariaCredit.status, "ACTIVE");
    const carlaCredit = (await call("GET", `/customers/${at(11).customerId}/credit`)).json().data;
    assert.equal(carlaCredit.currentMaxOverdueDays, 0);
    assert.equal(carlaCredit.status, "ACTIVE");
    assert.equal(carlaCredit.profileCode, "NEW");
    const anaCredit = (await call("GET", `/customers/${ana}/credit`)).json().data;
    assert.equal(anaCredit.profileCode, "GOOD");
    const history = await prisma.creditLimitChange.findMany({ where: { customerId: ana } });
    assert.ok(history.some((h) => h.source === "LEGACY_IMPORT"));

    // 7) Parcelar o saldo a combinar da Ana: 3 × 100
    const anaDoc = at(9).financialDocumentId!;
    const anaParcel = await prisma.financialParcel.findFirstOrThrow({ where: { financialDocumentId: anaDoc } });
    const split = await call("POST", `/receivables/${anaDoc}/parcels/${anaParcel.id}/split`, {
      parcels: [30, 60, 90].map((d) => ({ dueDate: addDays(d), amount: 100 })),
    });
    assert.equal(split.statusCode, 200, split.body);
    const splitParcels = split.json().data.parcels as { dueDateUnknown: boolean; amount: number }[];
    assert.equal(splitParcels.length, 3);
    assert.ok(splitParcels.every((x) => !x.dueDateUnknown && x.amount === 100));
    assert.equal((await call("GET", `/customers/${ana}/credit`)).json().data.openBalance, 300);

    // 8) Pagamento bloqueia o desfazer; estornado, desfaz
    const joanaDoc = at(6).financialDocumentId!;
    const joanaParcel = await prisma.financialParcel.findFirstOrThrow({ where: { financialDocumentId: joanaDoc } });
    const pay = await call("POST", `/receivables/${joanaDoc}/parcels/${joanaParcel.id}/payments`, { amount: 100, method: "PIX" });
    assert.equal(pay.statusCode, 201, pay.body);
    const blocked = await call("POST", `/legacy-imports/${batchId}/revert`, {});
    assert.equal(blocked.statusCode, 409);
    assert.equal(blocked.json().code, "LEGACY_BATCH_HAS_PAYMENTS");
    const paymentId = pay.json().data.parcels[0].payments[0].id;
    assert.equal((await call("POST", `/receivables/payments/${paymentId}/reverse`, { reason: "teste" })).statusCode, 200);

    const reverted = await call("POST", `/legacy-imports/${batchId}/revert`, {});
    assert.equal(reverted.statusCode, 200, reverted.body);
    assert.equal(reverted.json().data.status, "REVERTED");
    const statuses = await prisma.financialDocument.findMany({
      where: { originType: "LEGACY", originId: { in: rows.map((x) => x.id) } },
      select: { status: true },
    });
    assert.ok(statuses.every((d) => d.status === "CANCELED"));
    const afterRevert = (await call("GET", `/customers/${maria}/credit`)).json().data;
    assert.equal(afterRevert.openBalance, 0);
    assert.equal(afterRevert.legacyOpenBalance, 0);
    // Limite que a importação deu volta ao de antes (300 do perfil Novo), pois ninguém mexeu na ficha depois.
    assert.equal(afterRevert.limit, 300, "desfazer restaura o limite anterior à importação");
    assert.ok(
      (reverted.json().data.creditRestore.restored as { customerId: string }[]).some((c) => c.customerId === maria),
    );
    assert.ok(await prisma.customer.findUnique({ where: { id: maria } }), "cliente criado continua");
  });
});
